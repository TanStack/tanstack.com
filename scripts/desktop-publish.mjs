import { assertNewerRelease } from './chat/desktop-release-version.mjs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const builder = createRequire(
  require.resolve('../desktop/node_modules/electron-builder'),
)
const yaml = createRequire(builder.resolve('app-builder-lib'))('js-yaml')
const directory = 'dist/desktop/'
const manifest = yaml.load(readFileSync(directory + 'latest-mac.yml', 'utf8'))
const updateUrl = process.env.TANSTACK_UPDATE_URL
const releaseBucket = process.env.TANSTACK_RELEASE_BUCKET
if (!updateUrl || !releaseBucket)
  throw Error(
    'Set TANSTACK_UPDATE_URL and TANSTACK_RELEASE_BUCKET before publishing',
  )
const feedUrl = new URL(updateUrl)
if (
  feedUrl.protocol !== 'https:' ||
  feedUrl.username ||
  feedUrl.password ||
  feedUrl.search ||
  feedUrl.hash
)
  throw Error('The update directory must be a plain HTTPS URL')
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(releaseBucket))
  throw Error('Invalid release bucket name')
const origin = feedUrl.href.replace(/\/$/, '')
const releasePrefix = decodeURIComponent(feedUrl.pathname)
  .split('/')
  .filter(Boolean)
  .join('/')
if (
  releasePrefix &&
  (!/^[a-zA-Z0-9._/-]+$/.test(releasePrefix) ||
    releasePrefix.split('/').some((part) => part === '.' || part === '..'))
)
  throw Error('Invalid update directory path')
const objectPrefix = releasePrefix
  ? `${releaseBucket}/${releasePrefix}`
  : releaseBucket
if (manifest.files?.length !== 2)
  throw Error('Expected ZIP and DMG release artifacts')
const currentResponse = await fetch(`${origin}/latest-mac.yml`, {
  cache: 'no-store',
})
if (!currentResponse.ok && currentResponse.status !== 404)
  throw Error('Cannot read current update feed')
if (currentResponse.status === 404) {
  assertNewerRelease(manifest.version, null)
} else {
  const current = yaml.load(await currentResponse.text())
  assertNewerRelease(manifest.version, current?.version)
}
const existing = new Set()
const upload = (name, cache) =>
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${objectPrefix}/${name}`,
      '--remote',
      '--file',
      directory + name,
      '--cache-control',
      cache,
    ],
    { stdio: 'inherit' },
  )
for (const entry of manifest.files) {
  if (!/^TanStack-\d+\.\d+\.\d+-arm64\.(zip|dmg)$/.test(entry.url))
    throw Error('Unexpected artifact filename')
  const data = readFileSync(directory + entry.url)
  if (
    data.length !== entry.size ||
    createHash('sha512').update(data).digest('base64') !== entry.sha512
  )
    throw Error('Local release hash mismatch')
  // Versioned files must never be replaced once published.
  const exists = await fetch(`${origin}/${entry.url}`, { method: 'HEAD' })
  if (exists.ok) {
    const response = await fetch(`${origin}/${entry.url}`)
    if (!response.ok) throw Error('Cannot verify existing artifact')
    const hash = createHash('sha512')
    for await (const chunk of response.body) hash.update(chunk)
    if (hash.digest('base64') !== entry.sha512)
      throw Error(
        'Refusing to replace an existing version with different bytes',
      )
    existing.add(entry.url)
  } else if (exists.status !== 404)
    throw Error(`Cannot check artifact: ${entry.url}`)
}
for (const entry of manifest.files) {
  if (!existing.has(entry.url))
    upload(entry.url, 'public, max-age=31536000, immutable')
  upload(entry.url + '.blockmap', 'public, max-age=31536000, immutable')
  const response = await fetch(`${origin}/${entry.url}`)
  if (!response.ok) throw Error('Published artifact cannot be downloaded')
  const hash = createHash('sha512')
  let size = 0
  for await (const chunk of response.body) {
    hash.update(chunk)
    size += chunk.length
  }
  if (size !== entry.size || hash.digest('base64') !== entry.sha512)
    throw Error('Published artifact hash mismatch')
}
// Only advertise an update after every artifact has been checked over HTTPS.
upload('latest-mac.yml', 'no-cache')
const response = await fetch(`${origin}/latest-mac.yml`, { cache: 'no-store' })
if (
  !response.ok ||
  (await response.text()) !== readFileSync(directory + 'latest-mac.yml', 'utf8')
)
  throw Error('Published feed differs from verified release')
console.log(`Published TanStack ${manifest.version}`)
