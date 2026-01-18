import { createHash } from 'node:crypto'

export const hashPixels = (pixels: Uint8Array) =>
  createHash('sha256').update(pixels).digest('hex')
