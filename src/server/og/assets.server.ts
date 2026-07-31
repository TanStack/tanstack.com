import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fetchStaticAsset } from '~/server/runtime/host.server'

const interRegularUrl = '/fonts/Inter-Regular.ttf'
const bricolageBoldUrl = '/fonts/BricolageGrotesque-Bold.ttf'
const brandLogoPngUrl = '/images/brand/tanstack-landscape-black-640.png'
const brandEmblemPngUrl = '/images/brand/tanstack-emblem-charcoal-256.png'
const brandEmblemCreamPngUrl = '/images/brand/tanstack-emblem-cream-256.png'

function tryReadBinary(relPath: string): Buffer | null {
  // Resolve from the project root for local dev and tests. Workers normally
  // load these through the static assets binding below.
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
  bricolageBold: Buffer
  brandLogoPng: Buffer
  brandEmblemPng: Buffer
  brandEmblemCreamPng: Buffer
} | null = null

export async function loadOgAssets(requestUrl?: string) {
  if (cached) return cached

  const interRegular = tryReadBinary('public/fonts/Inter-Regular.ttf')
  const bricolageBold = tryReadBinary(
    'public/fonts/BricolageGrotesque-Bold.ttf',
  )
  const brandLogoPng = tryReadBinary(
    'public/images/brand/tanstack-landscape-black-640.png',
  )
  const brandEmblemPng = tryReadBinary(
    'public/images/brand/tanstack-emblem-charcoal-256.png',
  )
  const brandEmblemCreamPng = tryReadBinary(
    'public/images/brand/tanstack-emblem-cream-256.png',
  )

  if (
    interRegular &&
    bricolageBold &&
    brandLogoPng &&
    brandEmblemPng &&
    brandEmblemCreamPng
  ) {
    cached = {
      interRegular,
      bricolageBold,
      brandLogoPng,
      brandEmblemPng,
      brandEmblemCreamPng,
    }
    return cached
  }

  if (!requestUrl) {
    throw new Error('OG asset URL fallback requires a request URL')
  }

  cached = {
    interRegular: await readAssetUrl(interRegularUrl, requestUrl),
    bricolageBold: await readAssetUrl(bricolageBoldUrl, requestUrl),
    brandLogoPng: await readAssetUrl(brandLogoPngUrl, requestUrl),
    brandEmblemPng: await readAssetUrl(brandEmblemPngUrl, requestUrl),
    brandEmblemCreamPng: await readAssetUrl(brandEmblemCreamPngUrl, requestUrl),
  }
  return cached
}
