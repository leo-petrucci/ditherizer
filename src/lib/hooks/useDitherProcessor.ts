import { useCallback, useEffect, useRef, useState } from 'react'

import { applyPaletteDitherClient } from '@/lib/image/ditherClient'

type Size = { width: number; height: number }

type ProcessOptions = {
  maxColors: number
  scale: number
  ditherMode?: 'ordered' | 'diffusion' | 'none'
  colorReduction?:
    | 'perceptual'
    | 'perceptual-plus'
    | 'selective'
    | 'adaptive'
    | 'restrictive'
}

type ProcessResult = {
  outputUrl: string | null
  outputSize: Size | null
  sourceSize: Size | null
  isProcessing: boolean
  error: string | null
  process: (options: ProcessOptions) => void
  reset: () => void
}

/**
 * Handle image decoding, caching, and dither processing with a stable API.
 */
export const useDitherProcessor = (sourceFile: File | null): ProcessResult => {
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [outputSize, setOutputSize] = useState<Size | null>(null)
  const [sourceSize, setSourceSize] = useState<Size | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Track the current output URL for cleanup between renders.
   */
  const outputUrlRef = useRef<string | null>(null)

  /**
   * Cache decoded ImageData for reprocessing without re-decoding.
   */
  const sourceImageDataRef = useRef<ImageData | null>(null)

  /**
   * Prevent overlapping processing runs.
   */
  const processingLockRef = useRef(false)

  /**
   * Token that increments on file changes to ignore stale async work.
   */
  const loadTokenRef = useRef(0)

  /**
   * Release object URLs to avoid memory leaks.
   */
  const revokeUrl = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * Reset cached state when a new file is selected.
   */
  const reset = useCallback(() => {
    revokeUrl(outputUrlRef.current)
    outputUrlRef.current = null
    setOutputUrl(null)
    setOutputSize(null)
    setSourceSize(null)
    setError(null)
    sourceImageDataRef.current = null
    loadTokenRef.current += 1
  }, [])

  /**
   * Keep the latest output URL available for cleanup.
   */
  useEffect(() => {
    outputUrlRef.current = outputUrl
    return () => {
      revokeUrl(outputUrl)
    }
  }, [outputUrl])

  /**
   * Clear cached data when the source file changes.
   */
  useEffect(() => {
    reset()
  }, [sourceFile, reset])

  /**
   * Decode the source image into ImageData, guarding against stale results.
   */
  const loadImageData = useCallback(
    async (file: File, token: number) => {
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

      if (loadTokenRef.current !== token) {
        return null
      }

      return { imageData, width: canvas.width, height: canvas.height }
    },
    []
  )

  /**
   * Run the palette + dithering pipeline and update output state.
   */
  const process = useCallback(
    async (options: ProcessOptions) => {
      if (!sourceFile || processingLockRef.current) {
        return
      }

      processingLockRef.current = true
      setIsProcessing(true)
      setError(null)

      try {
        let imageData = sourceImageDataRef.current
        let width = sourceSize?.width ?? 0
        let height = sourceSize?.height ?? 0

        if (!imageData) {
          const token = loadTokenRef.current
          const loaded = await loadImageData(sourceFile, token)
          if (!loaded) {
            return
          }
          imageData = loaded.imageData
          width = loaded.width
          height = loaded.height
          sourceImageDataRef.current = imageData
        setSourceSize({ width, height })
      }

        const result = await applyPaletteDitherClient(imageData, {
          maxColors: options.maxColors,
          scale: options.scale,
          ditherMode: options.ditherMode,
          colorReduction: options.colorReduction,
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
    },
    [loadImageData, sourceFile, sourceSize]
  )

  return { outputUrl, outputSize, sourceSize, isProcessing, error, process, reset }
}
