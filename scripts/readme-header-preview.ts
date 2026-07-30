/**
 * Renders the GitHub README header banner for every library to
 * `.readme-preview/`, plus an index.html gallery for eyeballing them.
 * Run with: pnpm exec tsx scripts/readme-header-preview.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { libraries } from '../src/libraries/libraries'
import { generateReadmeHeaderResponse } from '../src/server/og/generate.server'
import type { Framework } from '../src/libraries/types'

const OUT_DIR = resolve(process.cwd(), '.readme-preview')

async function renderToFile(
  fileName: string,
  input: Parameters<typeof generateReadmeHeaderResponse>[0],
) {
  const result = await generateReadmeHeaderResponse(input)
  if ('kind' in result) {
    console.warn(`[skip] ${fileName}: ${result.kind}`)
    return false
  }
  writeFileSync(
    resolve(OUT_DIR, fileName),
    Buffer.from(await result.arrayBuffer()),
  )
  console.log(`[ok] ${fileName}`)
  return true
}

function buildGallery(
  entries: Array<{ name: string; files: Array<{ file: string; url: string }> }>,
) {
  return `<!doctype html>
<meta charset="utf-8">
<title>TanStack README header preview</title>
<style>
  body { margin: 0; padding: 40px; background: #121212; color: #eeebd4;
         font: 16px/1.4 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p.lede { margin: 0 0 40px; opacity: .55; font-size: 14px; max-width: 70ch; }
  section { margin-bottom: 48px; }
  h2 { font-size: 15px; letter-spacing: .08em; text-transform: uppercase;
       opacity: .55; margin: 0 0 12px; font-weight: 600; }
  figure { margin: 0 0 20px; }
  figcaption { font-size: 12px; opacity: .5; margin-bottom: 6px;
               font-family: ui-monospace, monospace; }
  /* 900px matches how GitHub renders these inside a README. */
  img { width: 900px; max-width: 100%; display: block; border: 1px solid #2e2e2e; }
</style>
<h1>GitHub README headers &mdash; local render</h1>
<p class="lede">Shown at 900px, the width GitHub renders README images at.
Each caption is the endpoint URL a repo would put in its README.</p>
${entries
  .map(
    (entry) => `<section>
  <h2>${entry.name}</h2>
  ${entry.files
    .map(
      ({ file, url }) =>
        `<figure><figcaption>${url}</figcaption><img src="./${file}" alt=""></figure>`,
    )
    .join('\n  ')}
</section>`,
  )
  .join('\n')}
`
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const entries: Array<{
    name: string
    files: Array<{ file: string; url: string }>
  }> = []

  for (const lib of libraries) {
    if (!lib.to) continue // skip entries without a landing page (react-charts, create-tsrouter-app)

    const files: Array<{ file: string; url: string }> = []

    const base = `${lib.id}-readme.png`
    if (await renderToFile(base, { libraryId: lib.id })) {
      files.push({ file: base, url: `/api/readme/${lib.id}.png` })
    }

    // Per-package variants, for repos whose framework packages ship their own
    // READMEs (packages/react-start/README.md and friends).
    for (const framework of lib.frameworks as Array<Framework>) {
      const file = `${lib.id}-readme-${framework}.png`
      if (await renderToFile(file, { libraryId: lib.id, framework })) {
        files.push({
          file,
          url: `/api/readme/${lib.id}.png?framework=${framework}`,
        })
      }
    }

    entries.push({ name: lib.name, files })
  }

  writeFileSync(resolve(OUT_DIR, 'index.html'), buildGallery(entries))
  console.log(`[ok] index.html`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
