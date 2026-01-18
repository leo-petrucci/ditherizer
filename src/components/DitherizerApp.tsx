import { Sparkles } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { ControlsPanel } from '@/components/ControlsPanel'
import { PreviewPanel } from '@/components/PreviewPanel'
import { UploadCard } from '@/components/UploadCard'
import { useDitherProcessor } from '@/lib/hooks/useDitherProcessor'

const MAX_COLORS = 256
const MIN_COLORS = 2
const DEFAULT_COLORS = 256
const MIN_SCALE = 0.1
const MAX_SCALE = 1

/**
 * Main Ditherizer Studio page.
 */
export function DitherizerApp() {
  /**
   * Uploaded file and preview URL for the original image.
   */
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  /**
   * User-controlled palette size and scale values.
   */
  const [maxColors, setMaxColors] = useState(DEFAULT_COLORS)
  const [scale, setScale] = useState(1)

  /**
   * Toggle between processed and original preview.
   */
  const [showProcessed, setShowProcessed] = useState(true)
  const [ditherMode, setDitherMode] = useState<'ordered' | 'diffusion' | 'none'>('ordered')

  /**
   * Refs store the last committed values for processing.
   */
  const maxColorsRef = useRef(maxColors)
  const scaleRef = useRef(scale)

  /**
   * Cache of the last processed settings to prevent duplicate work.
   */
  const lastProcessedRef = useRef<{
    colors: number
    scale: number
    mode: 'ordered' | 'diffusion' | 'none'
  } | null>(null)

  /**
   * Processing hook handles decode, dithering, and output caching.
   */
  const {
    outputUrl,
    outputSize,
    sourceSize,
    isProcessing,
    error,
    process,
    reset,
  } = useDitherProcessor(sourceFile)

  /**
   * Choose which preview URL and label should be visible.
   */
  const previewUrl = showProcessed ? outputUrl || sourceUrl : sourceUrl
  const previewLabel = showProcessed ? 'Processed' : 'Original'

  /**
   * Use processed output size if available, otherwise estimate from source.
   */
  /**
   * Use processed output size if available, otherwise estimate from source.
   */
  const displayOutputSize = useMemo(() => {
    if (outputSize) {
      return outputSize
    }
    if (!sourceSize) {
      return null
    }
    return {
      width: Math.max(1, Math.round(sourceSize.width * scale)),
      height: Math.max(1, Math.round(sourceSize.height * scale)),
    }
  }, [outputSize, scale, sourceSize])

  /**
   * Trigger processing only when inputs have changed.
   */
  const triggerProcessing = (
    colors: number,
    nextScale: number,
    mode: 'ordered' | 'diffusion' | 'none'
  ) => {
    if (!sourceFile) {
      return
    }
    const last = lastProcessedRef.current
    if (last && last.colors === colors && last.scale === nextScale && last.mode === mode) {
      return
    }
    lastProcessedRef.current = { colors, scale: nextScale, mode }
    process({ maxColors: colors, scale: nextScale, ditherMode: mode })
  }

  /**
   * Reset processing state and cache when a new file is selected.
   */
  const handleFileSelect = (file: File | null) => {
    reset()
    lastProcessedRef.current = null
    setSourceFile(file)

    if (!file) {
      setSourceUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(file)
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl)
    }
    setSourceUrl(nextUrl)
    triggerProcessing(maxColorsRef.current, scaleRef.current, ditherMode)
  }

  /**
   * Update palette size while the slider is moving.
   */
  const handleMaxColorsChange = (value: number) => {
    const clamped = Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(value)))
    maxColorsRef.current = clamped
    setMaxColors(clamped)
  }

  /**
   * Update scale while the slider is moving.
   */
  const handleScaleChange = (value: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
    scaleRef.current = clamped
    setScale(clamped)
  }

  /**
   * Commit palette size and trigger processing after release/blur.
   */
  const handleMaxColorsCommit = (value: number) => {
    const clamped = Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(value)))
    maxColorsRef.current = clamped
    setMaxColors(clamped)
    triggerProcessing(clamped, scaleRef.current, ditherMode)
  }

  /**
   * Commit scale and trigger processing after release/blur.
   */
  const handleScaleCommit = (value: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
    scaleRef.current = clamped
    setScale(clamped)
    triggerProcessing(maxColorsRef.current, clamped, ditherMode)
  }

  /**
   * Commit the dither mode selection and trigger reprocessing.
   */
  const handleDitherModeChange = (mode: 'ordered' | 'diffusion' | 'none') => {
    setDitherMode(mode)
    triggerProcessing(maxColorsRef.current, scaleRef.current, mode)
  }

  /**
   * Download the currently processed PNG.
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
            <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-[#f7c07b]/20 backdrop-blur">
              <ControlsPanel
                maxColors={maxColors}
                scale={scale}
                showProcessed={showProcessed}
                ditherMode={ditherMode}
                disabled={!sourceFile || isProcessing}
                isProcessing={isProcessing}
                onMaxColorsChange={handleMaxColorsChange}
                onMaxColorsCommit={handleMaxColorsCommit}
                onScaleChange={handleScaleChange}
                onScaleCommit={handleScaleCommit}
                onTogglePreview={setShowProcessed}
                onDitherModeChange={handleDitherModeChange}
                onDownload={handleDownload}
              />

              <div className="mt-6">
                <UploadCard
                  sourceFile={sourceFile}
                  sourceSize={sourceSize}
                  onFileSelected={handleFileSelect}
                />
              </div>

              {error && (
                <p className="mt-6 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
            </div>

            <PreviewPanel
              previewUrl={previewUrl}
              previewLabel={previewLabel}
              outputSize={displayOutputSize}
              maxColors={maxColors}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
