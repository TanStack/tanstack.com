import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const updateUrl = process.env.TANSTACK_UPDATE_URL
if (updateUrl) {
  const url = new URL(updateUrl)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'TANSTACK_UPDATE_URL must be an HTTPS directory URL without credentials or query parameters.',
    )
  }
}

export default {
  beforePack: ({ packager }) => {
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./build-device-helper.mjs', import.meta.url))],
      { stdio: 'inherit' },
    )
    if (!packager.config.forceCodeSigning) return
    if (!updateUrl)
      throw new Error(
        'Set TANSTACK_UPDATE_URL to the hosted native update directory before making a release.',
      )
    const env = process.env
    const notarization =
      env.APPLE_KEYCHAIN_PROFILE ||
      (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) ||
      (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
    if (!notarization)
      throw new Error(
        'Configure Apple notarization credentials before making a release.',
      )
  },
  appId: 'com.tanstack.desktop',
  productName: 'TanStack',
  asar: true,
  asarUnpack: ['native/folder-access'],
  forceCodeSigning: true,
  directories: { output: '../dist/desktop' },
  files: [
    '*.mjs',
    '!*.test.mjs',
    '!builder.config.mjs',
    'preload.cjs',
    'package.json',
    'native/folder-access',
  ],
  extraMetadata: { nativeUpdates: Boolean(updateUrl) },
  publish: updateUrl ? [{ provider: 'generic', url: updateUrl }] : null,
  mac: {
    icon: '../public/images/logos/logo-color-600.png',
    category: 'public.app-category.productivity',
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    notarize: true,
  },
  artifactName: 'TanStack-${version}-${arch}.${ext}',
  dmg: { sign: true },
}
