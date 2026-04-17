import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readBinary(relPath: string): Buffer {
  // Resolve from the project root. In Netlify functions the working directory
  // is the function bundle root, which includes `public/` via the included_files
  // config. Locally (dev + preview script) cwd is the repo root.
  return readFileSync(resolve(process.cwd(), relPath))
}

let cached: {
  interRegular: Buffer
  interExtraBold: Buffer
  islandDataUrl: string
} | null = null

export function loadOgAssets() {
  if (cached) return cached

  const interRegular = readBinary('public/fonts/Inter-Regular.ttf')
  const interExtraBold = readBinary('public/fonts/Inter-ExtraBold.ttf')
  const islandBytes = readBinary('public/images/logos/splash-dark.png')
  const islandDataUrl = `data:image/png;base64,${islandBytes.toString('base64')}`

  cached = { interRegular, interExtraBold, islandDataUrl }
  return cached
}
