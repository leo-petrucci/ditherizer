// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyPaletteDitherClient } from './ditherClient'

const samplePixels = [
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 0, 255,
  0, 0, 0, 255, 255, 255, 255, 255,
  128, 128, 128, 255, 64, 64, 64, 255,
]

const createImageData = (pixels: number[], width: number, height: number) => {
  const data = new Uint8ClampedArray(pixels)
  return new ImageData(data, width, height)
}

describe('applyPaletteDitherClient', () => {
  beforeEach(() => {
    if (!globalThis.ImageData) {
      const polyfill = class ImageDataPolyfill {
        data: Uint8ClampedArray
        width: number
        height: number

        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data
          this.width = width
          this.height = height
        }
      }
      Object.defineProperty(globalThis, 'ImageData', {
        value: polyfill,
        configurable: true,
        writable: true,
      })
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws if canvas context is unavailable', async () => {
    const imageData = createImageData(samplePixels, 4, 2)
    const original = HTMLCanvasElement.prototype.getContext

    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof original

    await expect(
      applyPaletteDitherClient(imageData, {
        maxColors: 4,
        scale: 1,
        dither: false,
      })
    ).rejects.toThrow('Canvas context unavailable')

    HTMLCanvasElement.prototype.getContext = original
  })
})
