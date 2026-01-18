import { applyPaletteSync, buildPaletteSync, utils } from 'image-q'
import type { ColorDistanceFormula, ImageQuantization } from 'image-q'

export type DitherMode = 'ordered' | 'diffusion' | 'none'

export interface DitherClientOptions {
  maxColors: number
  scale?: number
  ditherMode?: DitherMode
  colorDistanceFormula?: ColorDistanceFormula
}

export interface DitherClientResult {
  blob: Blob
  width: number
  height: number
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
  height: number
) => {
  const thresholdScale = 16
  const thresholdBias = 24
  const output = new Uint8ClampedArray(pixels.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const threshold = (BAYER_4X4[y % 4][x % 4] / thresholdScale - 0.5) * thresholdBias

      output[index] = clamp8(pixels[index] + threshold)
      output[index + 1] = clamp8(pixels[index + 1] + threshold)
      output[index + 2] = clamp8(pixels[index + 2] + threshold)
      output[index + 3] = pixels[index + 3]
    }
  }

  return output
}

/**
 * Resize image data by a scale factor using canvas resampling.
 */
const resizeImageData = (imageData: ImageData, scale: number) => {
  const targetWidth = Math.max(1, Math.round(imageData.width * scale))
  const targetHeight = Math.max(1, Math.round(imageData.height * scale))

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = imageData.width
  sourceCanvas.height = imageData.height

  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) {
    throw new Error('Canvas context unavailable')
  }

  sourceContext.putImageData(imageData, 0, 0)

  const targetCanvas = document.createElement('canvas')
  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight

  const targetContext = targetCanvas.getContext('2d')
  if (!targetContext) {
    throw new Error('Canvas context unavailable')
  }

  targetContext.imageSmoothingEnabled = true
  targetContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)

  const resized = targetContext.getImageData(0, 0, targetWidth, targetHeight)
  return { imageData: resized, width: targetWidth, height: targetHeight }
}

/**
 * Encode a canvas to a PNG Blob.
 */
const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode image'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

/**
 * Dither image data in the browser using image-q and return a PNG Blob.
 */
export const applyPaletteDitherClient = async (
  imageData: ImageData,
  options: DitherClientOptions
): Promise<DitherClientResult> => {
  const scale = clamp(options.scale ?? 1, 0.1, 1)
  const maxColors = clamp(Math.round(options.maxColors), 2, 256)
  const colorDistanceFormula = options.colorDistanceFormula ?? DEFAULT_DISTANCE
  const ditherMode = options.ditherMode ?? 'ordered'

  const { imageData: resized, width, height } = resizeImageData(imageData, scale)

  const paletteSource =
    ditherMode === 'ordered' ? orderedDither(resized.data, width, height) : resized.data
  const pointContainer = utils.PointContainer.fromUint8Array(paletteSource, width, height)

  const palette = buildPaletteSync([pointContainer], {
    colors: maxColors,
    paletteQuantization: 'wuquant',
    colorDistanceFormula,
  })

  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula,
    imageQuantization: ditherMode === 'diffusion' ? DITHER_ALGO : NEAREST_ALGO,
  })

  const outputPixels = new Uint8ClampedArray(quantized.toUint8Array())
  const outputImage = new ImageData(outputPixels, width, height)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height

  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) {
    throw new Error('Canvas context unavailable')
  }

  outputContext.putImageData(outputImage, 0, 0)
  const blob = await canvasToBlob(outputCanvas)

  return { blob, width, height }
}
