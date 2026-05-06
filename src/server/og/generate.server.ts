import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
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
const WASM_REL_PATH = 'node_modules/@takumi-rs/wasm/pkg/takumi_wasm_bg.wasm'
const WASM_PNPM_REL_PATH =
  'node_modules/@takumi-rs/wasm/pkg/takumi_wasm_bg.wasm'

let cachedWasmBytes: Uint8Array | null = null
function loadTakumiWasm(): Uint8Array {
  if (cachedWasmBytes) return cachedWasmBytes
  const candidatePaths = [
    // Standard module resolution — works in dev and any environment that
    // hoists @takumi-rs/wasm to top-level node_modules.
    tryRequireResolve('@takumi-rs/wasm/takumi_wasm_bg.wasm'),
    // Top-level pnpm hoist (also via require but without the subpath
    // exports indirection).
    join(process.cwd(), WASM_REL_PATH),
    // Netlify Functions deploy: pnpm packages live under
    // node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>/. The function
    // bundler isn't symlinking @takumi-rs/wasm at top-level, so walk .pnpm
    // and find the matching directory.
    findInPnpmStore('@takumi-rs+wasm@', WASM_PNPM_REL_PATH),
  ].filter((p): p is string => Boolean(p))

  for (const path of candidatePaths) {
    if (existsSync(path)) {
      cachedWasmBytes = readFileSync(path)
      return cachedWasmBytes
    }
  }
  throw new Error(
    `Could not locate @takumi-rs/wasm/pkg/takumi_wasm_bg.wasm. Tried: ${candidatePaths.join(', ')}`,
  )
}

function tryRequireResolve(specifier: string): string | null {
  try {
    return createRequire(import.meta.url).resolve(specifier)
  } catch {
    return null
  }
}

function findInPnpmStore(pkgPrefix: string, relPath: string): string | null {
  const pnpmDir = join(process.cwd(), 'node_modules', '.pnpm')
  if (!existsSync(pnpmDir)) return null
  for (const entry of readdirSync(pnpmDir)) {
    if (entry.startsWith(pkgPrefix)) {
      const candidate = join(pnpmDir, entry, relPath)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
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
