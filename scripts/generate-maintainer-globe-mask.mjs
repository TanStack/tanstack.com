import { readFileSync, writeFileSync } from 'node:fs'
import { geoContains } from 'd3'

const land = JSON.parse(
  readFileSync(
    new URL('../src/data/maintainers-land.json', import.meta.url),
    'utf8',
  ),
)
const samples = 24000
const mask = Buffer.alloc(Math.ceil(samples / 8))
const goldenFraction = (Math.sqrt(5) - 1) / 2

// Keep the same Fibonacci ordering as the browser renderer.
for (let index = 0; index < samples; index++) {
  const latitude = (Math.asin(1 - (2 * index) / samples) * 180) / Math.PI
  const longitude = 180 - ((index * goldenFraction + 0.5) % 1) * 360
  if (geoContains(land, [longitude, latitude])) {
    mask[index >> 3] |= 1 << (index & 7)
  }
}

writeFileSync(
  new URL('../src/data/maintainers-globe-land-mask.json', import.meta.url),
  JSON.stringify({ samples, landMask: mask.toString('base64') }, null, 2) +
    '\n',
)
