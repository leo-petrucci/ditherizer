// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyPaletteDitherClient } from './ditherClient'
import { hashPixels } from './hash'

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

const createCanvasStub = () => {
  const context = {
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => new ImageData(new Uint8ClampedArray(16), 2, 2)),
    imageSmoothingEnabled: true,
  }

  return {
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (blob: Blob) => void) => {
      callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
    }),
    width: 2,
    height: 2,
    _context: context,
  }
}

describe('applyPaletteDitherClient', () => {
  let lastImageData: ImageData | null = null

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

    const originalCreateElement = Document.prototype.createElement
    vi.spyOn(document, 'createElement').mockImplementation(function (
      this: Document,
      tagName,
      options,
    ) {
      if (tagName === 'canvas') {
        const canvasStub = createCanvasStub()
        vi.spyOn(canvasStub._context, 'putImageData').mockImplementation((imageData) => {
          lastImageData = imageData
        })
        vi.spyOn(canvasStub._context, 'drawImage').mockImplementation((
          _source,
          _sx,
          _sy,
          targetWidth?: number,
          targetHeight?: number
        ) => {
          canvasStub.width = typeof targetWidth === 'number' ? targetWidth : canvasStub.width
          canvasStub.height = typeof targetHeight === 'number' ? targetHeight : canvasStub.height
        })
        vi.spyOn(canvasStub._context, 'getImageData').mockImplementation(() => {
          const size = canvasStub.width * canvasStub.height * 4
          return new ImageData(new Uint8ClampedArray(size), canvasStub.width, canvasStub.height)
        })
        return canvasStub as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(this, tagName, options)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    lastImageData = null
  })

  it('returns a PNG blob with scaled dimensions', async () => {
    const imageData = createImageData(samplePixels, 4, 2)

    const result = await applyPaletteDitherClient(imageData, {
      maxColors: 4,
      scale: 0.5,
      ditherMode: 'ordered',
      colorReduction: 'selective',
    })

    expect(result.width).toBe(2)
    expect(result.height).toBe(1)
    expect(result.blob.type).toBe('image/png')
  })

  it('clamps scale and maxColors values', async () => {
    const imageData = createImageData(samplePixels, 4, 2)

    const result = await applyPaletteDitherClient(imageData, {
      maxColors: 999,
      scale: 25,
      ditherMode: 'ordered',
      colorReduction: 'selective',
    })

    expect(result.width).toBe(4)
    expect(result.height).toBe(2)
  })

  it('produces deterministic output for ordered dithering', async () => {
    const imageData = createImageData(samplePixels, 4, 2)

    await applyPaletteDitherClient(imageData, {
      maxColors: 4,
      scale: 1,
      ditherMode: 'ordered',
      colorReduction: 'selective',
    })

    expect(lastImageData).not.toBeNull()
    if (!lastImageData) {
      return
    }

    expect(hashPixels(lastImageData.data as any)).toBe(
      'b660ff8f782aa12962f7cea3ecfc7585da74439f3f226606afdff8a0a58ab07a'
    )
  })

  it('throws if canvas context is unavailable', async () => {
    const imageData = createImageData(samplePixels, 4, 2)
    const originalCreateElement = Document.prototype.createElement

    vi.spyOn(document, 'createElement').mockImplementation(function (
      this: Document,
      tagName,
      options,
    ) {
      if (tagName === 'canvas') {
        return {
          getContext: () => null,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(this, tagName, options)
    })

    await expect(
      applyPaletteDitherClient(imageData, {
        maxColors: 4,
        scale: 1,
        ditherMode: 'ordered',
      colorReduction: 'perceptual-plus',

      })
    ).rejects.toThrow('Canvas context unavailable')
  })
})
