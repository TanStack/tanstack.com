import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distServerDir = path.join(rootDir, 'dist/server')
const rscTempDir = path.join(rootDir, 'node_modules/.vite-rsc-temp/rsc')
const rscDistDir = path.join(distServerDir, 'rsc')
const instrumentSource = path.join(rootDir, 'src/instrument.server.mjs')
const instrumentDest = path.join(distServerDir, 'instrument.server.mjs')

if (!fs.existsSync(rscTempDir)) {
  throw new Error(`Missing RSC temp output: ${rscTempDir}`)
}

fs.rmSync(rscDistDir, { force: true, recursive: true })
fs.cpSync(rscTempDir, rscDistDir, { recursive: true })
fs.copyFileSync(instrumentSource, instrumentDest)
