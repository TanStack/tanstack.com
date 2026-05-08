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
  interBlack: Buffer
  islandPng: Buffer
} | null = null

export function loadOgAssets() {
  if (cached) return cached

  cached = {
    interRegular: readBinary('public/fonts/Inter-Regular.ttf'),
    interExtraBold: readBinary('public/fonts/Inter-ExtraBold.ttf'),
    interBlack: readBinary('public/fonts/Inter-Black.ttf'),
    islandPng: readBinary('public/images/logos/splash-dark.png'),
  }
  return cached
}
