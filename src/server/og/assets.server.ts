import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import interRegularUrl from '../../../public/fonts/Inter-Regular.ttf?url'
import interExtraBoldUrl from '../../../public/fonts/Inter-ExtraBold.ttf?url'
import interBlackUrl from '../../../public/fonts/Inter-Black.ttf?url'
import islandPngUrl from '../../../public/images/logos/splash-dark.png?url'
import { fetchStaticAsset } from '~/server/runtime/host.server'

function tryReadBinary(relPath: string): Buffer | null {
  // Resolve from the project root. In Netlify functions the working directory
  // is the function bundle root, which includes `public/` via the included_files
  // config. Locally (dev + preview script) cwd is the repo root.
  try {
    return readFileSync(resolve(process.cwd(), relPath))
  } catch {
    return null
  }
}

async function readAssetUrl(assetUrl: string, requestUrl: string) {
  const url = new URL(assetUrl, requestUrl)
  const response = await fetchStaticAsset(url)

  if (!response.ok) {
    throw new Error(`Failed to load OG asset ${assetUrl}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

let cached: {
  interRegular: Buffer
  interExtraBold: Buffer
  interBlack: Buffer
  islandPng: Buffer
} | null = null

export async function loadOgAssets(requestUrl?: string) {
  if (cached) return cached

  const interRegular = tryReadBinary('public/fonts/Inter-Regular.ttf')
  const interExtraBold = tryReadBinary('public/fonts/Inter-ExtraBold.ttf')
  const interBlack = tryReadBinary('public/fonts/Inter-Black.ttf')
  const islandPng = tryReadBinary('public/images/logos/splash-dark.png')

  if (interRegular && interExtraBold && interBlack && islandPng) {
    cached = {
      interRegular,
      interExtraBold,
      interBlack,
      islandPng,
    }
    return cached
  }

  if (!requestUrl) {
    throw new Error('OG asset URL fallback requires a request URL')
  }

  cached = {
    interRegular: await readAssetUrl(interRegularUrl, requestUrl),
    interExtraBold: await readAssetUrl(interExtraBoldUrl, requestUrl),
    interBlack: await readAssetUrl(interBlackUrl, requestUrl),
    islandPng: await readAssetUrl(islandPngUrl, requestUrl),
  }
  return cached
}
