// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { DitherizerApp } from '@/components/DitherizerApp'

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

describe('DitherizerApp UI', () => {
  const renderApp = () => render(<DitherizerApp />)

  beforeEach(() => {
    const originalCreateElement = Document.prototype.createElement
    const canvasStub = createCanvasStub()

    vi.spyOn(document, 'createElement').mockImplementation(function (
      this: Document,
      tagName,
      options,
    ) {
      if (tagName === 'canvas') {
        return canvasStub as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(this, tagName, options)
    })

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

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 2, height: 2, close: vi.fn() }))
    )

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the dropzone and disabled controls initially', () => {
    renderApp()

    expect(screen.getByTestId('image-dropzone')).toBeInTheDocument()
    expect(screen.getByTestId('colors-slider')).toHaveAttribute('data-disabled')
    expect(screen.getByTestId('scale-slider')).toHaveAttribute('data-disabled')
    expect(screen.getByTestId('download-button')).toBeDisabled()
  })

  it('enables controls after an image is selected', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('colors-slider')).not.toHaveAttribute('data-disabled')
      expect(screen.getByTestId('scale-slider')).not.toHaveAttribute('data-disabled')
    })

    await waitFor(() =>
      expect(screen.getByTestId('preview-image')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('preview-label')).toHaveTextContent('Processed')
    expect(screen.getByTestId('file-info')).toHaveTextContent('sample.png')
  })

  it('updates the palette label when the colors input changes', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const colorsInput = await screen.findByTestId('colors-input')
    fireEvent.change(colorsInput, { target: { value: '32' } })
    fireEvent.blur(colorsInput)

    await waitFor(() => {
      expect(screen.getByTestId('palette-label')).toHaveTextContent(
        'Palette: 32 colors',
      )
    })
  })

  it('toggles the preview label between original and processed', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const originalToggle = await screen.findByTestId('toggle-original')
    fireEvent.click(originalToggle)
    expect(screen.getByTestId('preview-label')).toHaveTextContent('Original')

    const processedToggle = screen.getByTestId('toggle-processed')
    fireEvent.click(processedToggle)
    expect(screen.getByTestId('preview-label')).toHaveTextContent('Processed')
  })

  it('updates the output size label when scale changes', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const scaleInput = await screen.findByTestId('scale-input')
    fireEvent.change(scaleInput, { target: { value: '0.5' } })
    fireEvent.blur(scaleInput)

    await waitFor(() => {
      expect(screen.getByTestId('output-size')).toHaveTextContent('Output: 1 x 1px')
    })
  })

  it('switches dither mode selection', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const diffusionButton = await screen.findByTestId('dither-diffusion')
    fireEvent.click(diffusionButton)

    await waitFor(() => {
      expect(screen.getByTestId('dither-diffusion')).toHaveClass('bg-slate-900')
    })
  })

  it('switches color reduction selection', async () => {
    renderApp()

    const file = new File([new Uint8ClampedArray([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const adaptiveButton = await screen.findByTestId('reduction-perceptual-plus')
    fireEvent.click(adaptiveButton)

    await waitFor(() => {
      expect(screen.getByTestId('reduction-perceptual-plus')).toHaveClass('bg-slate-900')
    })
  })

  it('enables the download button after processing completes', async () => {
    renderApp()

    const file = new File([new Uint8Array([1])], 'sample.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('image-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(screen.getByTestId('download-button')).not.toBeDisabled(),
    )
  })
})
