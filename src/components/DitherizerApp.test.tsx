// @vitest-environment jsdom
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
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
  }
}

describe('index route UI', () => {
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
  })

  it('renders the dropzone and disabled controls initially', () => {
    renderApp()

    expect(screen.getByTestId('image-dropzone')).toBeInTheDocument()
    expect(screen.getByTestId('colors-slider')).toBeDisabled()
    expect(screen.getByTestId('scale-slider')).toBeDisabled()
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
      expect(screen.getByTestId('colors-slider')).not.toBeDisabled()
      expect(screen.getByTestId('scale-slider')).not.toBeDisabled()
    })

    await waitFor(() =>
      expect(screen.getByTestId('preview-image')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('preview-label')).toHaveTextContent('Processed')
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
})
