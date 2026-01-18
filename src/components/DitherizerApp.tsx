import { Download, ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { applyPaletteDitherClient } from '@/lib/image/ditherClient'

const MAX_COLORS = 256
const MIN_COLORS = 2
const DEFAULT_COLORS = 256
const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 0.05

/**
 * Format the scale value for display in the UI.
 */
const formatScaleLabel = (value: number) => `${value.toFixed(2)}x`

/**
 * Clamp a numeric value between min and max.
 */
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Main Ditherizer Studio page.
 */
export function DitherizerApp() {
  /**
   * Uploaded file and associated preview URLs.
   */
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const outputUrlRef = useRef<string | null>(null)
  const processingLockRef = useRef(false)
  const lastProcessedRef = useRef<{ colors: number; scale: number } | null>(null)

  /**
   * Source and output dimensions tracked for display.
   */
  const [outputSize, setOutputSize] = useState<{ width: number; height: number } | null>(null)
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)

  /**
   * Control values for palette size, scale, and preview state.
   */
  const [maxColors, setMaxColors] = useState(DEFAULT_COLORS)
  const [scale, setScale] = useState(1)
  const [showProcessed, setShowProcessed] = useState(true)

  /**
   * Processing state and any errors returned from the pipeline.
   */
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * References for committed values used when processing on blur/commit.
   */
  const maxColorsRef = useRef(maxColors)
  const scaleRef = useRef(scale)

  /**
   * Preformatted label for the current scale.
   */
  const currentScaleLabel = useMemo(() => formatScaleLabel(scale), [scale])

  /**
   * Output size derived from the scale when a processed image isn't available yet.
   */
  const derivedOutputSize = useMemo(() => {
    if (!sourceSize) {
      return null
    }
    return {
      width: Math.max(1, Math.round(sourceSize.width * scale)),
      height: Math.max(1, Math.round(sourceSize.height * scale)),
    }
  }, [sourceSize, scale])

  /**
   * Prefer the measured output size once a render completes.
   */
  const displayOutputSize = outputSize ?? derivedOutputSize

  /**
   * Helper to clean up object URLs and avoid leaking memory.
   */
  const revokeUrl = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * Cleanup any blob URLs on unmount or when they change.
   */
  useEffect(() => {
    outputUrlRef.current = outputUrl
    return () => {
      revokeUrl(sourceUrl)
      revokeUrl(outputUrl)
    }
  }, [sourceUrl, outputUrl])

  /**
   * Clear any rendered output when a new file is selected.
   */
  const resetOutput = () => {
    revokeUrl(outputUrl)
    setOutputUrl(null)
    setOutputSize(null)
  }

  /**
   * Update state when a file is selected via input or drag-and-drop.
   */
  const handleFileSelect = (file: File | null) => {
    setError(null)
    resetOutput()

    if (!file) {
      setSourceFile(null)
      revokeUrl(sourceUrl)
      setSourceUrl(null)
      setSourceSize(null)
      return
    }

    setSourceFile(file)
    const nextUrl = URL.createObjectURL(file)
    revokeUrl(sourceUrl)
    setSourceUrl(nextUrl)
  }

  /**
   * Handle file input changes from the hidden upload element.
   */
  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    handleFileSelect(file)
  }

  /**
   * Decode an uploaded image into ImageData using an offscreen canvas.
   */
  const loadImageData = async (file: File) => {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas context unavailable')
    }

    context.drawImage(bitmap, 0, 0)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    bitmap.close()

    return { imageData, width: canvas.width, height: canvas.height }
  }

  /**
   * Run the client-side dithering pipeline and update preview state.
   * Guards against overlapping renders when sliders emit multiple commits.
   */
  const processImage = useCallback(async (file: File, colors: number, nextScale: number) => {
    if (processingLockRef.current) {
      return
    }
    processingLockRef.current = true
    setIsProcessing(true)
    setError(null)

    try {
      const { imageData, width, height } = await loadImageData(file)
      setSourceSize({ width, height })

      const result = await applyPaletteDitherClient(imageData, {
        maxColors: colors,
        scale: nextScale,
        dither: true,
      })

      revokeUrl(outputUrlRef.current)
      const nextUrl = URL.createObjectURL(result.blob)
      outputUrlRef.current = nextUrl
      setOutputUrl(nextUrl)
      setOutputSize({ width: result.width, height: result.height })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process image.'
      setError(message)
    } finally {
      processingLockRef.current = false
      setIsProcessing(false)
    }
  }, [])

  /**
   * Trigger processing with the current or provided settings.
   */
  const triggerProcessing = useCallback(
    (nextColors = maxColorsRef.current, nextScale = scaleRef.current) => {
      if (!sourceFile) {
        return
      }
      const last = lastProcessedRef.current
      if (last && last.colors === nextColors && last.scale === nextScale) {
        return
      }
      lastProcessedRef.current = { colors: nextColors, scale: nextScale }
      processImage(sourceFile, nextColors, nextScale)
    },
    [sourceFile, processImage]
  )

  useEffect(() => {
    if (!sourceFile) {
      return
    }
    triggerProcessing(maxColorsRef.current, scaleRef.current)
  }, [sourceFile, triggerProcessing])

  /**
   * Update palette size while the slider is moving.
   */
  const handleColorsChange = (value: number) => {
    const clamped = clamp(Math.round(value), MIN_COLORS, MAX_COLORS)
    maxColorsRef.current = clamped
    setMaxColors(clamped)
  }

  /**
   * Update scale while the slider is moving.
   */
  const handleScaleChange = (value: number) => {
    const clamped = clamp(value, MIN_SCALE, MAX_SCALE)
    scaleRef.current = clamped
    setScale(clamped)
  }

  /**
   * Commit palette size changes when the slider is released or input blurred.
   */
  const handleColorsCommit = (value: number) => {
    const clamped = clamp(Math.round(value), MIN_COLORS, MAX_COLORS)
    maxColorsRef.current = clamped
    setMaxColors(clamped)
    triggerProcessing(clamped, scaleRef.current)
  }

  /**
   * Commit scale changes when the slider is released or input blurred.
   */
  const handleScaleCommit = (value: number) => {
    const clamped = clamp(value, MIN_SCALE, MAX_SCALE)
    scaleRef.current = clamped
    setScale(clamped)
    triggerProcessing(maxColorsRef.current, clamped)
  }

  /**
   * Commit palette size changes from the number input.
   */
  const handleColorBlur = (event: ChangeEvent<HTMLInputElement>) => {
    handleColorsCommit(Number(event.currentTarget.value))
  }

  /**
   * Commit scale changes from the number input.
   */
  const handleScaleBlur = (event: ChangeEvent<HTMLInputElement>) => {
    handleScaleCommit(Number(event.currentTarget.value))
  }

  /**
   * Trigger a download of the processed PNG.
   */
  const handleDownload = () => {
    if (!outputUrl) {
      return
    }

    const link = document.createElement('a')
    link.href = outputUrl
    link.download = 'dithered.png'
    link.click()
  }

  /**
   * Allow drag-and-drop uploads on the dropzone.
   */
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (event.dataTransfer.files.length === 0) {
      return
    }
    const file = event.dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }

  /**
   * Prevent the browser from opening the file directly on drag-over.
   */
  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
  }

  /**
   * Resolve which preview image to show based on toggle state.
   */
  const previewUrl = showProcessed ? outputUrl || sourceUrl : sourceUrl
  const previewLabel = showProcessed ? 'Processed' : 'Original'

  return (
    <div className="min-h-screen bg-[#f6f1e7] text-slate-900" data-testid="ditherizer-root">
      <div className="relative overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#f7c07b]/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-64 w-64 rounded-full bg-[#7bd4c7]/35 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-[#8aa2d9]/25 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-12">
          <header className="flex flex-col gap-4 pb-10">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 shadow">
                <Sparkles className="h-4 w-4" />
              </span>
              Ditherizer Studio
            </div>
            <h1 className="font-display text-4xl sm:text-5xl leading-tight text-slate-900">
              Save-for-web style palette reduction with live preview.
            </h1>
            <p className="max-w-2xl text-base text-slate-600">
              Upload an image, tune the palette, and resize for a crisp pixel-art feel.
              The preview updates when you finish adjusting each control.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <section className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-[#f7c07b]/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">Controls</h2>
                {isProcessing && (
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-6">
                <div className="space-y-3">
                  <label
                    htmlFor="image-upload"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    data-testid="image-dropzone"
                    className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 transition hover:border-slate-400"
                  >
                    <ImageIcon className="h-7 w-7" />
                    <div>
                      <p className="font-medium text-slate-700">Drop an image here</p>
                      <p className="text-xs text-slate-500">or click to browse</p>
                    </div>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    data-testid="image-input"
                    onChange={handleUploadChange}
                  />
                  {sourceFile && (
                    <div
                      className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600"
                      data-testid="file-info"
                    >
                      <p className="font-medium text-slate-700">{sourceFile.name}</p>
                      {sourceSize && (
                        <p>
                          Original: {sourceSize.width} x {sourceSize.height}px
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Palette size</p>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {maxColors} colors
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_COLORS}
                    max={MAX_COLORS}
                    step={1}
                    value={maxColors}
                    data-testid="colors-slider"
                    className="w-full accent-slate-900"
                    disabled={!sourceFile}
                    onChange={(event) => handleColorsChange(Number(event.currentTarget.value))}
                    onPointerUp={(event) => handleColorsCommit(Number(event.currentTarget.value))}
                    onKeyUp={(event) => handleColorsCommit(Number(event.currentTarget.value))}
                  />
                  <input
                    type="number"
                    min={MIN_COLORS}
                    max={MAX_COLORS}
                    value={maxColors}
                    data-testid="colors-input"
                    disabled={!sourceFile}
                    onChange={(event) => handleColorsChange(Number(event.currentTarget.value))}
                    onBlur={handleColorBlur}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">Scale output</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
                      {currentScaleLabel}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={SCALE_STEP}
                    value={scale}
                    data-testid="scale-slider"
                    className="w-full accent-slate-900"
                    disabled={!sourceFile}
                    onChange={(event) => handleScaleChange(Number(event.currentTarget.value))}
                    onPointerUp={(event) => handleScaleCommit(Number(event.currentTarget.value))}
                    onKeyUp={(event) => handleScaleCommit(Number(event.currentTarget.value))}
                  />
                  <input
                    type="number"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={SCALE_STEP}
                    value={scale}
                    data-testid="scale-input"
                    disabled={!sourceFile}
                    onChange={(event) => handleScaleChange(Number(event.currentTarget.value))}
                    onBlur={handleScaleBlur}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Preview mode</p>
                  <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1">
                    {['Original', 'Processed'].map((label) => {
                      const active = (label === 'Processed') === showProcessed
                      return (
                        <button
                          key={label}
                          type="button"
                          data-testid={label === 'Processed' ? 'toggle-processed' : 'toggle-original'}
                          onClick={() => setShowProcessed(label === 'Processed')}
                          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                            active ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!outputUrl}
                  data-testid="download-button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </button>

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-lg shadow-[#7bd4c7]/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
                  <h2 className="font-display text-2xl" data-testid="preview-label">
                    {previewLabel}
                  </h2>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {displayOutputSize ? (
                    <p data-testid="output-size">
                      Output: {displayOutputSize.width} x {displayOutputSize.height}px
                    </p>
                  ) : (
                    <p data-testid="output-size">Output: --</p>
                  )}
                  <p data-testid="palette-label">Palette: {maxColors} colors</p>
                </div>
              </div>

              <div
                className="preview-grid mt-6 flex min-h-[380px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50"
                data-testid="preview-container"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Dithered preview"
                    data-testid="preview-image"
                    className="max-h-[420px] w-auto rounded-xl border border-white shadow-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-slate-400">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                    <p className="text-sm">Upload an image to begin previewing.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
