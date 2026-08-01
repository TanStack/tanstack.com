import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fetchStaticAsset } from '~/server/runtime/host.server'

const interRegularUrl = '/fonts/Inter-Regular.ttf'
const bricolageBoldUrl = '/fonts/BricolageGrotesque-Bold.ttf'
const imageAssets = {
  logo: {
    path: 'public/images/brand/tanstack-landscape-black-640.png',
    url: '/images/brand/tanstack-landscape-black-640.png',
  },
  emblem: {
    path: 'public/images/brand/tanstack-emblem-charcoal-256.png',
    url: '/images/brand/tanstack-emblem-charcoal-256.png',
  },
  'emblem-cream': {
    path: 'public/images/brand/tanstack-emblem-cream-256.png',
    url: '/images/brand/tanstack-emblem-cream-256.png',
  },
}

type ImageAsset = keyof typeof imageAssets

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

type FontAssets = {
  interRegular: Buffer
  bricolageBold: Buffer
}

let cachedFonts: FontAssets | null = null
const cachedImages = new Map<ImageAsset, Buffer>()

async function loadAsset(
  relPath: string,
  assetUrl: string,
  requestUrl: string | undefined,
) {
  const localAsset = tryReadBinary(relPath)
  if (localAsset) return localAsset

  if (!requestUrl) {
    throw new Error('OG asset URL fallback requires a request URL')
  }

  return readAssetUrl(assetUrl, requestUrl)
}

async function loadFonts(requestUrl?: string) {
  if (cachedFonts) return cachedFonts

  const [interRegular, bricolageBold] = await Promise.all([
    loadAsset('public/fonts/Inter-Regular.ttf', interRegularUrl, requestUrl),
    loadAsset(
      'public/fonts/BricolageGrotesque-Bold.ttf',
      bricolageBoldUrl,
      requestUrl,
    ),
  ])

  cachedFonts = { interRegular, bricolageBold }
  return cachedFonts
}

export async function loadOgAssets(
  imageAsset: ImageAsset,
  requestUrl?: string,
) {
  const image = imageAssets[imageAsset]
  const [fonts, imageData] = await Promise.all([
    loadFonts(requestUrl),
    cachedImages.get(imageAsset) ??
      loadAsset(image.path, image.url, requestUrl),
  ])

  cachedImages.set(imageAsset, imageData)

  return { ...fonts, imageData }
}
