import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { loadOgAssets } from './assets.server'
import { getAccentColor } from './colors'
import { buildOgTree } from './template'

const MAX_TITLE_LENGTH = 80
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
  const libraryName = library.name
  const pitch = clampText(library.tagline ?? '', MAX_DESCRIPTION_LENGTH)
  const docTitle = input.title?.trim()
    ? clampText(input.title.trim(), MAX_TITLE_LENGTH)
    : undefined
  const description = input.description?.trim()
    ? clampText(input.description.trim(), MAX_DESCRIPTION_LENGTH)
    : undefined

  const tree = buildOgTree({
    libraryName,
    accentColor,
    islandDataUrl: assets.islandDataUrl,
    pitch,
    docTitle,
    description,
  })

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
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
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
  return resvg.render().asPng()
}

function clampText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}
