import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { loadOgAssets } from './assets.server'
import { getAccentColor } from './colors'
import { buildOgTree } from './template'

const MAX_DESCRIPTION_LENGTH = 160

type GenerateInput = {
  libraryId: LibraryId | string
  title?: string
  description?: string
}

export type OgLibraryNotFoundError = {
  kind: 'library-not-found'
  libraryId: string
}

export async function generateOgPng(
  input: GenerateInput,
): Promise<Buffer | OgLibraryNotFoundError> {
  const library = findLibrary(input.libraryId)
  if (!library) {
    return { kind: 'library-not-found', libraryId: input.libraryId }
  }

  const assets = loadOgAssets()
  const accentColor = getAccentColor(library.id)
  const libraryName = input.title?.trim() || library.name
  const rawDescription =
    input.description?.trim() || library.tagline || library.description || ''
  const description = clampDescription(rawDescription)

  const tree = buildOgTree({
    libraryName,
    accentColor,
    islandDataUrl: assets.islandDataUrl,
    description,
  })

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: assets.interRegular, weight: 700, style: 'normal' },
      { name: 'Inter', data: assets.interExtraBold, weight: 800, style: 'normal' },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
  return resvg.render().asPng()
}

function clampDescription(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text
  return text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd() + '…'
}
