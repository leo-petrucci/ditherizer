import { applyPaletteSync, buildPaletteSync, utils } from 'image-q'
import type { ColorDistanceFormula, ImageQuantization } from 'image-q'

export interface DitherClientOptions {
  maxColors: number
  scale?: number
  dither?: boolean
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

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
  const scale = clamp(options.scale ?? 1, 0.05, 12)
  const maxColors = clamp(Math.round(options.maxColors), 2, 256)
  const colorDistanceFormula = options.colorDistanceFormula ?? DEFAULT_DISTANCE

  const { imageData: resized, width, height } = resizeImageData(imageData, scale)
  const pointContainer = utils.PointContainer.fromUint8Array(resized.data, width, height)

  const palette = buildPaletteSync([pointContainer], {
    colors: maxColors,
    paletteQuantization: 'wuquant',
    colorDistanceFormula,
  })

  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula,
    imageQuantization: options.dither === false ? NEAREST_ALGO : DITHER_ALGO,
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
