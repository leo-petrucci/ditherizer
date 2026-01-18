import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyPaletteDither } from '../src/lib/image/dither'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '..')
const inputPath = path.resolve(rootDir, '../images/input.png')
const outputPath = path.resolve(rootDir, '../images/output.png')

const run = async () => {
  const output = await applyPaletteDither(inputPath, {
    maxColors: 16,
    dither: true,
    resize: {
      width: 320,
    },
  })

  await fs.writeFile(outputPath, output)
  console.log(`Wrote ${outputPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
