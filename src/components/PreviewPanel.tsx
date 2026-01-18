import { ImageIcon } from 'lucide-react'

type Size = { width: number; height: number }

type PreviewPanelProps = {
  previewUrl: string | null
  previewLabel: string
  outputSize: Size | null
  maxColors: number
}

/**
 * Shows the image preview and metadata.
 */
export const PreviewPanel = ({
  previewUrl,
  previewLabel,
  outputSize,
  maxColors,
}: PreviewPanelProps) => {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-lg shadow-[#7bd4c7]/20 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
          <h2 className="font-display text-2xl" data-testid="preview-label">
            {previewLabel}
          </h2>
        </div>
        <div className="text-right text-xs text-slate-500">
          {outputSize ? (
            <p data-testid="output-size">
              Output: {outputSize.width} x {outputSize.height}px
            </p>
          ) : (
            <p data-testid="output-size">Output: --</p>
          )}
          <p data-testid="palette-label">Palette: {maxColors} colors</p>
        </div>
      </div>

      <div
        className="preview-grid mt-6 flex min-h-[380px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
        data-testid="preview-container"
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Dithered preview"
            data-testid="preview-image"
            className="h-full w-full rounded-xl border border-white shadow-lg object-contain"
            style={{ imageRendering: 'pixelated' }}
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
  )
}
