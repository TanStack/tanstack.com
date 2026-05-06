import { ImageResponse } from '@takumi-rs/image-response'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { loadOgAssets } from './assets.server'
import { getAccentColor } from './colors'
import { buildOgTree } from './template'

const MAX_TITLE_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 160
const ISLAND_KEY = 'island'

type GenerateInput = {
  libraryId: LibraryId | string
  title?: string
  description?: string
}

export type OgLibraryNotFoundError = {
  kind: 'library-not-found'
  libraryId: string
}

export function generateOgImageResponse(
  input: GenerateInput,
  init?: ResponseInit,
): ImageResponse | OgLibraryNotFoundError {
  const library = findLibrary(input.libraryId)
  if (!library) {
    return { kind: 'library-not-found', libraryId: input.libraryId }
  }

  const assets = loadOgAssets()
  const tree = buildOgTree({
    libraryName: library.name,
    accentColor: getAccentColor(library.id),
    islandSrc: ISLAND_KEY,
    pitch: clampText(library.tagline ?? '', MAX_DESCRIPTION_LENGTH),
    docTitle: input.title?.trim()
      ? clampText(input.title.trim(), MAX_TITLE_LENGTH)
      : undefined,
    description: input.description?.trim()
      ? clampText(input.description.trim(), MAX_DESCRIPTION_LENGTH)
      : undefined,
  })

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    format: 'png',
    fonts: [
      {
        name: 'Inter',
        data: assets.interRegular,
        weight: 700,
        style: 'normal',
      },
      {
        name: 'Inter',
        data: assets.interExtraBold,
        weight: 800,
        style: 'normal',
      },
    ],
    persistentImages: [{ src: ISLAND_KEY, data: assets.islandPng }],
    ...init,
  })
}

function clampText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}
