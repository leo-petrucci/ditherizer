import fs from 'node:fs/promises'
import sharp from 'sharp'
import { applyPaletteSync, buildPaletteSync, utils } from 'image-q'
import type { ColorDistanceFormula, ImageQuantization } from 'image-q'

type PaletteColor = [number, number, number] | [number, number, number, number]

type ResizeOptions = {
  width?: number
  height?: number
  fit?: keyof sharp.FitEnum
  withoutEnlargement?: boolean
}

export interface DitherOptions {
  maxColors?: number
  palette?: Array<PaletteColor>
  dither?: boolean
  colorDistanceFormula?: ColorDistanceFormula
  resize?: ResizeOptions
}

const DEFAULT_DISTANCE: ColorDistanceFormula = 'euclidean-bt709'
const DITHER_ALGO: ImageQuantization = 'floyd-steinberg'
const NEAREST_ALGO: ImageQuantization = 'nearest'

/**
 * Clamp an RGB value into 8-bit range.
 */
const clamp8 = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

/**
 * Build a palette from a manual list of RGBA colors.
 */
const createManualPalette = (colors: Array<PaletteColor>) => {
  const palette = new utils.Palette()
  for (const color of colors) {
    const [r, g, b, a = 255] = color
    palette.add(utils.Point.createByRGBA(clamp8(r), clamp8(g), clamp8(b), clamp8(a)))
  }
  palette.sort()
  return palette
}

const resolveInput = async (input: Buffer | string) => {
  if (typeof input === 'string') {
    return fs.readFile(input)
  }
  return input
}

/**
 * Apply palette quantization and dithering to an image buffer or file path.
 */
export async function applyPaletteDither(input: Buffer | string, options: DitherOptions) {
  if (options.palette && options.palette.length < 2) {
    throw new Error('palette must contain at least 2 colors')
  }

  if (!options.palette?.length && (!options.maxColors || options.maxColors < 2)) {
    throw new Error('maxColors must be at least 2 when palette is not provided')
  }

  const buffer = await resolveInput(input)
  const image = sharp(buffer).ensureAlpha()

  if (options.resize?.width || options.resize?.height) {
    image.resize({
      width: options.resize.width,
      height: options.resize.height,
      fit: options.resize.fit ?? 'inside',
      withoutEnlargement: options.resize.withoutEnlargement ?? true,
    })
  }

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const pointContainer = utils.PointContainer.fromUint8Array(data, info.width, info.height)
  const colorDistanceFormula = options.colorDistanceFormula ?? DEFAULT_DISTANCE

  const palette = options.palette?.length
    ? createManualPalette(options.palette)
    : buildPaletteSync([pointContainer], {
        colors: options.maxColors,
        paletteQuantization: 'wuquant',
        colorDistanceFormula,
      })

  const imageQuantization = options.dither === false ? NEAREST_ALGO : DITHER_ALGO
  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula,
    imageQuantization,
  })

  const outputPixels = Buffer.from(quantized.toUint8Array())
  return sharp(outputPixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer()
}
