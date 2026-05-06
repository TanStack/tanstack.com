import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { ImageResponse } from '@takumi-rs/image-response'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { loadOgAssets } from './assets.server'
import { getAccentColor } from './colors'
import { buildOgTree } from './template'
import {
  MAX_OG_DESCRIPTION_LENGTH,
  MAX_OG_TITLE_LENGTH,
  clampOgText,
} from '~/utils/og-limits'

const ISLAND_KEY = 'island'

// Force takumi to render via @takumi-rs/wasm instead of @takumi-rs/core's
// native napi binding. The native loader requires platform-specific
// .node binaries (e.g. @takumi-rs/core-linux-x64-gnu) which Netlify's
// zip-it-and-ship-it consistently dropped from the function bundle —
// `external_node_modules` and explicit optionalDependencies didn't fix
// it. WASM is platform-agnostic and ships a single .wasm asset (listed
// in netlify.toml `included_files`).
let cachedWasmBytes: Uint8Array | null = null
function loadTakumiWasm(): Uint8Array {
  if (cachedWasmBytes) return cachedWasmBytes
  // @takumi-rs/wasm exposes the binary via the `./takumi_wasm_bg.wasm`
  // subpath in its `exports` map.
  const require = createRequire(import.meta.url)
  const wasmPath = require.resolve('@takumi-rs/wasm/takumi_wasm_bg.wasm')
  cachedWasmBytes = readFileSync(wasmPath)
  return cachedWasmBytes
}

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
    pitch: clampOgText(library.tagline ?? '', MAX_OG_DESCRIPTION_LENGTH),
    docTitle: input.title?.trim()
      ? clampOgText(input.title, MAX_OG_TITLE_LENGTH)
      : undefined,
    description: input.description?.trim()
      ? clampOgText(input.description, MAX_OG_DESCRIPTION_LENGTH)
      : undefined,
  })

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    format: 'png',
    // Passing `module` switches takumi-js's renderer to WASM (see
    // takumi-js/dist/render-*.mjs `getImports`).
    module: loadTakumiWasm(),
    fonts: [
      {
        name: 'Inter',
        data: assets.interRegular,
        weight: 400,
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
