import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
const results = []
const roots = process.argv.slice(2)
if (roots.length !== 2)
  throw new Error(
    'Pass the baseline and candidate production build directories.',
  )
for (const root of roots) {
  const assets = path.join(root, 'dist/server/assets')
  const name = fs
    .readdirSync(assets)
    .find((n) => n.startsWith('_tanstack-start-manifest_'))
  const mod = await import(pathToFileURL(path.join(assets, name)))
  const routes = mod.tsrStartManifest().routes
  const sizes = {}
  for (const id of [
    '__root__',
    '/',
    '/_library/$libraryId/$version/docs/framework/$framework/$',
    '/chat/w/$workspaceId',
  ]) {
    const route = routes[id]
    if (!route) continue
    const files = new Set([
      ...(routes.__root__.preloads ?? []),
      ...(routes.__root__.css ?? []),
      ...(route.preloads ?? []),
      ...(route.css ?? []),
    ])
    let raw = 0,
      gzip = 0
    for (const file of files) {
      const p = path.join(root, 'dist/client', file)
      if (fs.existsSync(p)) {
        const b = fs.readFileSync(p)
        raw += b.length
        gzip += gzipSync(b).length
      }
    }
    sizes[id] = { files: files.size, raw, gzip }
  }
  const clientFiles = fs
    .readdirSync(path.join(root, 'dist/client/assets'))
    .filter((n) => n.endsWith('.js'))
  results.push({
    root,
    routes: Object.keys(routes).length,
    sizes,
    totalClientJsBytes: clientFiles.reduce(
      (s, n) => s + fs.statSync(path.join(root, 'dist/client/assets', n)).size,
      0,
    ),
  })
}
console.log(JSON.stringify(results, null, 2))
