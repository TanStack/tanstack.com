import assert from 'node:assert/strict'
import {
  createMinimalLocalForgeSeedFiles,
  minimalLocalForgeSeedNeedsUpdate,
} from '../src/builder/runtime/local-template.server'

const brandedSeed = {
  'public/logo192.png': 'logo',
  'public/logo512.png': 'logo',
  'public/manifest.json': '{"name":"Create TanStack App Sample"}',
  'src/components/Footer.tsx': 'export default function Footer() {}',
  'src/components/Header.tsx': 'export default function Header() {}',
  'src/routes/__root.tsx': 'export const Route = null',
  'src/routes/about.tsx': 'export const Route = null',
  'src/routes/index.tsx': 'export const Route = null',
  'src/styles.css': '@import "tailwindcss";',
}

assert.equal(minimalLocalForgeSeedNeedsUpdate(brandedSeed), true)

const minimalSeed = createMinimalLocalForgeSeedFiles(brandedSeed)

assert.equal('public/logo192.png' in minimalSeed, false)
assert.equal('public/logo512.png' in minimalSeed, false)
assert.equal('src/components/Footer.tsx' in minimalSeed, false)
assert.equal('src/routes/about.tsx' in minimalSeed, false)
assert.match(minimalSeed['src/components/Header.tsx'] ?? '', /to="\/"/)
assert.doesNotMatch(minimalSeed['src/components/Header.tsx'] ?? '', /Docs/)
assert.doesNotMatch(minimalSeed['src/components/Header.tsx'] ?? '', /About/)
assert.match(minimalSeed['src/routes/index.tsx'] ?? '', /Start building/)
assert.match(minimalSeed['src/styles.css'] ?? '', /@import "tailwindcss"/)
assert.equal(minimalLocalForgeSeedNeedsUpdate(minimalSeed), false)

console.log('Forge minimal template verifier passed')
