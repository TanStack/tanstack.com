import { ImageResponse, type ImageResponseOptions } from 'takumi-js/response'
import type { ReactElement } from 'react'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import type { Framework } from '~/libraries/types'
import { loadOgAssets } from './assets.server'
import { getAccentColor, getThemeSurface, type OgTheme } from './colors'
import { buildOgTree } from './template'
import { buildReadmeHeaderTree } from './readme-template'
import {
  MAX_OG_DESCRIPTION_LENGTH,
  MAX_OG_TITLE_LENGTH,
  clampOgText,
} from '~/utils/og-limits'

const BRAND_LOGO_KEY = 'brand-logo'
const BRAND_EMBLEM_KEY = 'brand-emblem'
const BRAND_EMBLEM_CREAM_KEY = 'brand-emblem-cream'

type GenerateInput = {
  libraryId: LibraryId | string
  requestUrl?: string
  title?: string
  description?: string
}

export type ReadmeHeaderInput = {
  libraryId: LibraryId | string
  requestUrl?: string
  /** Already validated against the library's framework list by the route. */
  framework?: Framework
  title?: string
  subtitle?: string
  /** Defaults to the light (cream) surface. */
  theme?: OgTheme
}

export type OgLibraryNotFoundError = {
  kind: 'library-not-found'
  libraryId: string
}

async function renderOgImage(
  tree: ReactElement,
  size: { width: number; height: number },
  assets: {
    interRegular: Buffer
    bricolageBold: Buffer
    images: NonNullable<ImageResponseOptions['images']>
  },
  init?: ResponseInit,
): Promise<ImageResponse> {
  const options: ImageResponseOptions = {
    width: size.width,
    height: size.height,
    format: 'png',
    fonts: [
      {
        name: 'Inter',
        data: assets.interRegular,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Bricolage Grotesque',
        data: assets.bricolageBold,
        weight: 700,
        style: 'normal',
      },
    ],
    images: assets.images,
    ...init,
  }

  return new ImageResponse(tree, options)
}

export async function generateOgImageResponse(
  input: GenerateInput,
  init?: ResponseInit,
): Promise<ImageResponse | OgLibraryNotFoundError> {
  const library = findLibrary(input.libraryId)
  if (!library) {
    return { kind: 'library-not-found', libraryId: input.libraryId }
  }

  const assets = await loadOgAssets('logo', input.requestUrl)
  const tree = buildOgTree({
    libraryName: library.name,
    accentColor: getAccentColor(library.id),
    brandLogoSrc: BRAND_LOGO_KEY,
    pitch: clampOgText(library.tagline ?? '', MAX_OG_DESCRIPTION_LENGTH),
    docTitle: input.title?.trim()
      ? clampOgText(input.title, MAX_OG_TITLE_LENGTH)
      : undefined,
    description: input.description?.trim()
      ? clampOgText(input.description, MAX_OG_DESCRIPTION_LENGTH)
      : undefined,
  })

  return renderOgImage(
    tree,
    { width: 1200, height: 630 },
    {
      interRegular: assets.interRegular,
      bricolageBold: assets.bricolageBold,
      images: [{ src: BRAND_LOGO_KEY, data: assets.imageData }],
    },
    init,
  )
}

// "TanStack Start" + react → "TanStack React Start"
//
// Capitalizing the framework id reproduces every label in `frameworkOptions`
// (react → React, vanilla → Vanilla, …). Importing that module here is not an
// option: it pulls in framework logo SVGs, which breaks server/script bundles.
function withFrameworkLabel(name: string, framework: Framework): string {
  const label = framework.charAt(0).toUpperCase() + framework.slice(1)
  return name.startsWith('TanStack ')
    ? `TanStack ${label} ${name.slice('TanStack '.length)}`
    : `${label} ${name}`
}

export async function generateReadmeHeaderResponse(
  input: ReadmeHeaderInput,
  init?: ResponseInit,
): Promise<ImageResponse | OgLibraryNotFoundError> {
  const library = findLibrary(input.libraryId)
  if (!library) {
    return { kind: 'library-not-found', libraryId: input.libraryId }
  }

  const theme = input.theme ?? 'light'
  const assets = await loadOgAssets(
    theme === 'dark' ? 'emblem-cream' : 'emblem',
    input.requestUrl,
  )

  // An explicit title replaces the whole name, so the framework label is not
  // applied on top of it.
  const name = input.title?.trim()
    ? clampOgText(input.title, MAX_OG_TITLE_LENGTH)
    : input.framework
      ? withFrameworkLabel(library.name, input.framework)
      : library.name

  const tagline = input.subtitle?.trim() ? input.subtitle : library.tagline
  const surface = getThemeSurface(theme)
  const emblemSrc = theme === 'dark' ? BRAND_EMBLEM_CREAM_KEY : BRAND_EMBLEM_KEY

  const tree = buildReadmeHeaderTree({
    name,
    tagline: clampOgText(tagline ?? '', MAX_OG_DESCRIPTION_LENGTH),
    accentColor: getAccentColor(library.id, theme),
    emblemSrc,
    background: surface.background,
    secondaryText: surface.secondaryText,
  })

  return renderOgImage(
    tree,
    { width: 1800, height: 450 },
    {
      interRegular: assets.interRegular,
      bricolageBold: assets.bricolageBold,
      images: [{ src: emblemSrc, data: assets.imageData }],
    },
    init,
  )
}
