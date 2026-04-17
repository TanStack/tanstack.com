/**
 * Renders one OG image per library to `.og-preview/`.
 * Run with: pnpm exec tsx scripts/og-preview.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { libraries } from '../src/libraries/libraries'
import { generateOgPng } from '../src/server/og/generate.server'

const OUT_DIR = resolve(process.cwd(), '.og-preview')

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const lib of libraries) {
    if (!lib.to) continue // skip entries without a landing page (react-charts, create-tsrouter-app)

    // Landing-page variant (no explicit title/description)
    const landing = await generateOgPng({ libraryId: lib.id })
    if ('kind' in (landing as Record<string, unknown>)) {
      console.warn(`[skip] ${lib.id}: ${(landing as any).kind}`)
      continue
    }
    const landingPath = resolve(OUT_DIR, `${lib.id}.png`)
    writeFileSync(landingPath, landing as Buffer)
    console.log(`[ok] ${landingPath}`)

    // Docs-page variant (simulate a per-page title + description)
    const docs = await generateOgPng({
      libraryId: lib.id,
      title: `${lib.name} · Overview`,
      description: `${lib.tagline} Guides, API reference and examples in one place.`,
    })
    if ('kind' in (docs as Record<string, unknown>)) continue
    const docsPath = resolve(OUT_DIR, `${lib.id}-docs.png`)
    writeFileSync(docsPath, docs as Buffer)
    console.log(`[ok] ${docsPath}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
