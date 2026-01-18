import { ImageIcon } from 'lucide-react'
import type { DragEvent } from 'react'

import { Input } from '@/components/ui/input'

type Size = { width: number; height: number }

type UploadCardProps = {
  sourceFile: File | null
  sourceSize: Size | null
  onFileSelected: (file: File | null) => void
}

/**
 * Handles file selection and drag-and-drop for uploads.
 */
export const UploadCard = ({ sourceFile, sourceSize, onFileSelected }: UploadCardProps) => {
  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onFileSelected(file)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (event.dataTransfer.files.length === 0) {
      return
    }
    const file = event.dataTransfer.files[0]
    if (file.type.startsWith('image/')) {
      onFileSelected(file)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
  }

  return (
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
      <Input
        id="image-upload"
        type="file"
        accept="image/*"
        data-testid="image-input"
        className="hidden"
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
  )
}
