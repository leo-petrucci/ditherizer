import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { applyPaletteDither } from './dither'
import { hashPixels } from './hash'

const createInputPng = async (pixels: number[], width: number, height: number) =>
  sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } }).png().toBuffer()

const decodePixels = async (buffer: Buffer) => {
  const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return data
}

const getMetadata = async (buffer: Buffer) => sharp(buffer).metadata()

const uniqueColors = (pixels: Uint8Array) => {
  const colors = new Set<string>()
  for (let i = 0; i < pixels.length; i += 4) {
    colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`)
  }
  return colors
}

const samplePixels = [
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 0, 255,
  0, 0, 0, 255, 255, 255, 255, 255,
  128, 128, 128, 255, 64, 64, 64, 255,
]

const sampleWidth = 4
const sampleHeight = 2

describe('applyPaletteDither', () => {
  it('reduces the image to a deterministic palette', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    const output = await applyPaletteDither(inputPng, {
      maxColors: 4,
      dither: true,
      resize: {
        width: 2,
        height: 2,
        fit: 'fill',
      },
    })

    const outputPixels = await decodePixels(output)
    expect(hashPixels(outputPixels)).toBe(
      '5eea0503cce99e9f02ab2fe3b37a921fcd19e9f89515b022ec08494f04ff7437'
    )
  })

  it('throws when a manual palette has fewer than two colors', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    await expect(
      applyPaletteDither(inputPng, {
        palette: [[0, 0, 0]],
      })
    ).rejects.toThrow('palette must contain at least 2 colors')
  })

  it('throws when maxColors is invalid without a palette', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    await expect(
      applyPaletteDither(inputPng, {
        maxColors: 1,
      })
    ).rejects.toThrow('maxColors must be at least 2')
  })

  it('keeps original dimensions when no resize is provided', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    const output = await applyPaletteDither(inputPng, {
      maxColors: 4,
      dither: false,
    })

    const metadata = await getMetadata(output)
    expect(metadata.width).toBe(sampleWidth)
    expect(metadata.height).toBe(sampleHeight)
  })

  it('resizes output when resize options are provided', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    const output = await applyPaletteDither(inputPng, {
      maxColors: 4,
      dither: false,
      resize: {
        width: 1,
        height: 1,
        fit: 'fill',
      },
    })

    const metadata = await getMetadata(output)
    expect(metadata.width).toBe(1)
    expect(metadata.height).toBe(1)
  })

  it('limits the output to the provided manual palette', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    const output = await applyPaletteDither(inputPng, {
      palette: [
        [0, 0, 0],
        [255, 255, 255],
      ],
      dither: false,
    })

    const outputPixels = await decodePixels(output)
    const colors = uniqueColors(outputPixels)
    const allowed = new Set(['0,0,0,255', '255,255,255,255'])

    for (const color of colors) {
      expect(allowed.has(color)).toBe(true)
    }
    expect(colors.size).toBeLessThanOrEqual(2)
  })

  it('produces deterministic output when dithering is disabled', async () => {
    const inputPng = await createInputPng(samplePixels, sampleWidth, sampleHeight)

    const output = await applyPaletteDither(inputPng, {
      maxColors: 4,
      dither: false,
    })

    const outputPixels = await decodePixels(output)
    expect(hashPixels(outputPixels)).toBe(
      '09efee9c7dde0b0679de25624f79cb264a9ee18da65c92195bc5206157bfc86a'
    )
  })
})
