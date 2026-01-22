import { applyPaletteSync, buildPaletteSync, utils } from 'image-q'
import type {
  ColorDistanceFormula,
  ImageQuantization,
  PaletteQuantization,
} from 'image-q'

export type DitherMode = 'ordered' | 'diffusion' | 'none'
export type ColorReductionMode =
  | 'perceptual'
  | 'perceptual-plus'
  | 'selective'
  | 'adaptive'
  | 'restrictive'

export interface DitherWorkerOptions {
  maxColors: number
  scale?: number
  ditherMode?: DitherMode
  colorReduction?: ColorReductionMode
  colorDistanceFormula?: ColorDistanceFormula
}

const DEFAULT_DISTANCE: ColorDistanceFormula = 'euclidean-bt709'
const DITHER_ALGO: ImageQuantization = 'floyd-steinberg'
const NEAREST_ALGO: ImageQuantization = 'nearest'

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const clamp8 = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

const orderedDither = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) => {
  const thresholdScale = 16
  const thresholdBias = 24
  const output = new Uint8ClampedArray(pixels.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const threshold =
        (BAYER_4X4[y % 4][x % 4] / thresholdScale - 0.5) * thresholdBias

      output[index] = clamp8(pixels[index] + threshold)
      output[index + 1] = clamp8(pixels[index + 1] + threshold)
      output[index + 2] = clamp8(pixels[index + 2] + threshold)
      output[index + 3] = pixels[index + 3]
    }
  }

  return output
}

const resolveColorReduction = (mode: ColorReductionMode) => {
  switch (mode) {
    case 'perceptual-plus':
      return {
        paletteQuantization: 'neuquant-float' as PaletteQuantization,
      }
    case 'perceptual':
      return {
        paletteQuantization: 'wuquant' as PaletteQuantization,
        colorDistanceFormula: 'ciede2000' as ColorDistanceFormula,
      }
    case 'selective':
      return {
        paletteQuantization: 'neuquant' as PaletteQuantization,
      }
    case 'restrictive':
      return {
        paletteQuantization: 'rgbquant' as PaletteQuantization,
      }
    case 'adaptive':
    default:
      return {
        paletteQuantization: 'wuquant' as PaletteQuantization,
      }
  }
}

const resizeImageData = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
) => {
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const sourceCanvas = new OffscreenCanvas(width, height)
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) {
    throw new Error('Canvas context unavailable')
  }

  const sourceImage = new ImageData(
    new Uint8ClampedArray(pixels),
    width,
    height,
  )
  sourceContext.putImageData(sourceImage, 0, 0)

  const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const targetContext = targetCanvas.getContext('2d')
  if (!targetContext) {
    throw new Error('Canvas context unavailable')
  }

  targetContext.imageSmoothingEnabled = true
  targetContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)

  const resized = targetContext.getImageData(0, 0, targetWidth, targetHeight)
  return { imageData: resized, width: targetWidth, height: targetHeight }
}

const canvasToBlob = (canvas: OffscreenCanvas) =>
  canvas.convertToBlob({ type: 'image/png' })

self.onmessage = async (event: MessageEvent) => {
  try {
    const { imageData, options } = event.data as {
      imageData: { data: ArrayBuffer; width: number; height: number }
      options: DitherWorkerOptions
    }

    const scale = clamp(options.scale ?? 1, 0.1, 1)
    const maxColors = clamp(Math.round(options.maxColors), 2, 256)
    const ditherMode = options.ditherMode ?? 'ordered'
    const colorReduction = options.colorReduction ?? 'perceptual'

    const reductionConfig = resolveColorReduction(colorReduction)
    const colorDistanceFormula =
      options.colorDistanceFormula ??
      reductionConfig.colorDistanceFormula ??
      DEFAULT_DISTANCE

    const pixels = new Uint8ClampedArray(imageData.data)
    const {
      imageData: resized,
      width,
      height,
    } = resizeImageData(pixels, imageData.width, imageData.height, scale)

    const paletteSource =
      ditherMode === 'ordered'
        ? orderedDither(resized.data, width, height)
        : resized.data
    const pointContainer = utils.PointContainer.fromUint8Array(
      paletteSource,
      width,
      height,
    )

    const palette = buildPaletteSync([pointContainer], {
      colors: maxColors,
      paletteQuantization: reductionConfig.paletteQuantization,
      colorDistanceFormula,
    })

    const quantized = applyPaletteSync(pointContainer, palette, {
      colorDistanceFormula,
      imageQuantization:
        ditherMode === 'diffusion' ? DITHER_ALGO : NEAREST_ALGO,
    })

    const outputPixels = new Uint8ClampedArray(quantized.toUint8Array())
    const outputImage = new ImageData(outputPixels, width, height)

    const outputCanvas = new OffscreenCanvas(width, height)
    const outputContext = outputCanvas.getContext('2d')
    if (!outputContext) {
      throw new Error('Canvas context unavailable')
    }

    outputContext.putImageData(outputImage, 0, 0)
    const blob = await canvasToBlob(outputCanvas)

    self.postMessage({ blob, width, height })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to process image'
    self.postMessage({ error: message })
  }
}
