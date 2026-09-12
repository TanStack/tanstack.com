import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { libraries } from '../src/libraries/libraries'

const root = await mkdtemp(path.join(os.tmpdir(), 'tanstack-sitemap-'))
for (const library of libraries) {
  if (
    library.visible === false ||
    !library.latestVersion ||
    library.sitemap?.includeDocsPages !== true
  )
    continue
  const directory = path.join(
    root,
    library.repo.split('/')[1],
    library.docsRoot || 'docs',
  )
  await mkdir(directory, { recursive: true })
  await writeFile(
    path.join(directory, 'seo-completeness-probe.md'),
    '---\ntitle: Sitemap verification\n---\nSitemap verification fixture.\n',
  )
}
console.log(root)
