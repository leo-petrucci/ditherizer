import { Loader2 } from 'lucide-react'

import type { ColorReductionMode, DitherMode } from '@/lib/image/ditherClient'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'

type ControlsPanelProps = {
  maxColors: number
  minColors: number
  maxScale: number
  minScale: number
  scale: number
  showProcessed: boolean
  ditherMode: DitherMode
  colorReduction: ColorReductionMode
  disabled: boolean
  isProcessing: boolean
  onMaxColorsChange: (value: number) => void
  onMaxColorsCommit: (value: number) => void
  onScaleChange: (value: number) => void
  onScaleCommit: (value: number) => void
  onTogglePreview: (showProcessed: boolean) => void
  onDitherModeChange: (mode: DitherMode) => void
  onColorReductionChange: (mode: ColorReductionMode) => void
  onDownload: () => void
}

/**
 * UI controls for palette size, scale, toggles, and export.
 */
export const ControlsPanel = ({
  maxColors,
  minColors,
  maxScale,
  minScale,
  scale,
  showProcessed,
  ditherMode,
  colorReduction,
  disabled,
  isProcessing,
  onMaxColorsChange,
  onMaxColorsCommit,
  onScaleChange,
  onScaleCommit,
  onTogglePreview,
  onDitherModeChange,
  onColorReductionChange,
  onDownload,
}: ControlsPanelProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Controls</h2>
        {isProcessing && (
          <span className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Palette size</p>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            {maxColors} colors
          </span>
        </div>
        <Slider
          min={minColors}
          max={maxColors}
          step={1}
          value={[maxColors]}
          disabled={disabled}
          data-testid="colors-slider"
          onValueChange={(value) => onMaxColorsChange(value[0] ?? maxColors)}
          onValueCommit={(value) => onMaxColorsCommit(value[0] ?? maxColors)}
        />
        <Input
          type="number"
          min={minColors}
          max={maxColors}
          value={maxColors}
          data-testid="colors-input"
          disabled={disabled}
          onChange={(event) => onMaxColorsChange(Number(event.currentTarget.value))}
          onBlur={(event) => onMaxColorsCommit(Number(event.currentTarget.value))}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Scale output</p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {(scale * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          min={minScale}
          max={maxScale}
          step={0.05}
          value={[scale]}
          disabled={disabled}
          data-testid="scale-slider"
          onValueChange={(value) => onScaleChange(value[0] ?? scale)}
          onValueCommit={(value) => onScaleCommit(value[0] ?? scale)}
        />
        <Input
          type="number"
          min={minScale}
          max={maxScale}
          step={0.05}
          value={scale}
          data-testid="scale-input"
          disabled={disabled}
          onChange={(event) => onScaleChange(Number(event.currentTarget.value))}
          onBlur={(event) => onScaleCommit(Number(event.currentTarget.value))}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Color reduction</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { label: 'Perceptual', value: 'perceptual' },
              { label: 'Perceptual+', value: 'perceptual-plus' },
              { label: 'Selective', value: 'selective' },
              { label: 'Adaptive', value: 'adaptive' },
              { label: 'Restrictive', value: 'restrictive' },
            ] as const satisfies ReadonlyArray<{ label: string; value: ColorReductionMode }>
          ).map((mode) => {
            const active = colorReduction === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                data-testid={`reduction-${mode.value}`}
                onClick={() => onColorReductionChange(mode.value)}
                className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  active ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Dither mode</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { label: 'Pattern (Ordered)', value: 'ordered' },
              { label: 'Diffusion', value: 'diffusion' },
              { label: 'None', value: 'none' },
            ] as const satisfies ReadonlyArray<{ label: string; value: DitherMode }>
          ).map((mode) => {
            const active = ditherMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                data-testid={`dither-${mode.value}`}
                onClick={() => onDitherModeChange(mode.value)}
                className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  active ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
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
                onClick={() => onTogglePreview(label === 'Processed')}
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

      <Button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        data-testid="download-button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl"
      >
        Download PNG
      </Button>
    </div>
  )
}
