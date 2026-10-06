import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

// Use the same YAML and blockmap implementations as the locked builder.
const require = createRequire(import.meta.url)
const builderRequire = createRequire(
  require.resolve('../desktop/node_modules/electron-builder'),
)
const libRequire = createRequire(builderRequire.resolve('app-builder-lib'))
const yaml = libRequire('js-yaml')
const { buildBlockMap } = libRequire('./targets/blockmap/blockmap.js')
const directory = resolve('dist/desktop')
const manifestPath = join(directory, 'latest-mac.yml')
const manifest = yaml.load(readFileSync(manifestPath, 'utf8'))
const version = JSON.parse(readFileSync('desktop/package.json', 'utf8')).version
if (manifest.version !== version)
  throw new Error('Release version does not match desktop/package.json')
if (
  manifest.files?.length !== 2 ||
  new Set(manifest.files.map((entry) => entry.url)).size !== 2
)
  throw new Error('Expected one ZIP and one DMG')
const zip = manifest.files.find((entry) => entry.url.endsWith('.zip'))
if (!zip || manifest.path !== zip.url || manifest.sha512 !== zip.sha512)
  throw new Error('Invalid ZIP update metadata')
const run = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'inherit' })
  } catch {
    throw new Error(`${command} failed. See the tool output above.`)
  }
}
const verifyApp = (app) => {
  run('codesign', ['--verify', '--deep', '--strict', app])
}
const inspect = (file) => {
  const { spawnSync } = require('node:child_process')
  const result = spawnSync('codesign', ['-dv', '--verbose=2', file], {
    encoding: 'utf8',
  })
  if (
    result.status !== 0 ||
    !result.stderr.includes('TeamIdentifier=7A84LHNSXV') ||
    !result.stderr.includes('Authority=Developer ID Application:')
  )
    throw new Error('Unexpected signing identity')
}
const credentials = () => {
  const e = process.env
  if (e.APPLE_KEYCHAIN_PROFILE)
    return ['--keychain-profile', e.APPLE_KEYCHAIN_PROFILE]
  if (e.APPLE_API_KEY && e.APPLE_API_KEY_ID && e.APPLE_API_ISSUER)
    return [
      '--key',
      e.APPLE_API_KEY,
      '--key-id',
      e.APPLE_API_KEY_ID,
      '--issuer',
      e.APPLE_API_ISSUER,
    ]
  if (e.APPLE_ID && e.APPLE_APP_SPECIFIC_PASSWORD && e.APPLE_TEAM_ID)
    return [
      '--apple-id',
      e.APPLE_ID,
      '--password',
      e.APPLE_APP_SPECIFIC_PASSWORD,
      '--team-id',
      e.APPLE_TEAM_ID,
    ]
  throw new Error('Notarization credentials are missing')
}
for (const entry of manifest.files) {
  if (
    entry.url !== `TanStack-${version}-arm64.zip` &&
    entry.url !== `TanStack-${version}-arm64.dmg`
  )
    throw new Error('Unexpected release filename')
  const file = join(directory, entry.url)
  if (entry.url.endsWith('.zip')) {
    const scratch = mkdtempSync(join(tmpdir(), 'tanstack-release-'))
    try {
      run('ditto', ['-x', '-k', file, scratch])
      const app = join(scratch, 'TanStack.app')
      verifyApp(app)
      inspect(app)
      run('xcrun', ['stapler', 'validate', app])
      run('spctl', ['--assess', '--type', 'execute', '--verbose=4', app])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  } else {
    inspect(file)
    run('codesign', ['--verify', '--strict', file])
    if (!process.argv.includes('--verify-only')) {
      run('xcrun', ['notarytool', 'submit', file, ...credentials(), '--wait'])
      run('xcrun', ['stapler', 'staple', file])
    }
    run('xcrun', ['stapler', 'validate', file])
    run('spctl', [
      '--assess',
      '--type',
      'open',
      '--context',
      'context:primary-signature',
      '--verbose=4',
      file,
    ])
  }
  const contents = readFileSync(file)
  const sha512 = createHash('sha512').update(contents).digest('base64')
  if (process.argv.includes('--verify-only')) {
    if (entry.sha512 !== sha512 || entry.size !== contents.length)
      throw new Error('Release hash mismatch')
  } else {
    Object.assign(entry, { sha512, size: contents.length })
    await buildBlockMap(file, 'gzip', file + '.blockmap')
  }
}
if (!process.argv.includes('--verify-only'))
  writeFileSync(manifestPath, yaml.dump(manifest))
console.log(`Verified TanStack ${version}`)
