import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const publicDir = join(root, 'public')
const brandDir = join(publicDir, 'images', 'brand')
const fontsDir = join(publicDir, 'fonts')

if (!process.env.FONTCONFIG_FILE) {
  const fontConfig = [
    '/opt/homebrew/etc/fonts/fonts.conf',
    '/etc/fonts/fonts.conf',
  ].find(existsSync)

  if (fontConfig) process.env.FONTCONFIG_FILE = fontConfig
}

process.env.XDG_CACHE_HOME ??= join(tmpdir(), 'tanstack-brand-font-cache')

const { default: sharp } = await import('sharp')

const colors = {
  cream: '#eeebd4',
  charcoal: '#121212',
}

const emblemPath = join(brandDir, 'tanstack-emblem-charcoal.svg')
const creamEmblemPath = join(brandDir, 'tanstack-emblem-cream.svg')
const landscapePath = join(brandDir, 'tanstack-landscape-black.svg')
const heroPath = join(publicDir, 'images', 'hero-palm-gradient-1600.webp')
const displayFontPath = join(fontsDir, 'BricolageGrotesque-Bold.ttf')

await mkdir(brandDir, { recursive: true })

async function squareIcon(emblemHeight) {
  const emblem = await sharp(emblemPath, { density: 1200 })
    .resize({ height: emblemHeight })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: colors.cream,
    },
  })
    .composite([{ input: emblem, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function resizePng(input, size) {
  return sharp(input)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer()
}

function buildIco(images) {
  const directorySize = 6 + images.length * 16
  const directory = Buffer.alloc(directorySize)
  directory.writeUInt16LE(0, 0)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(images.length, 4)

  let offset = directorySize

  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16
    directory.writeUInt8(size === 256 ? 0 : size, entry)
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1)
    directory.writeUInt8(0, entry + 2)
    directory.writeUInt8(0, entry + 3)
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })

  return Buffer.concat([directory, ...images.map(({ data }) => data)])
}

async function renderText(text, { color, dpi, width }) {
  const mask = await sharp({
    text: {
      text,
      font: 'Bricolage Grotesque Bold',
      fontfile: displayFontPath,
      width,
      align: 'left',
      dpi,
      spacing: 0,
    },
  })
    .greyscale()
    .png()
    .toBuffer()

  const metadata = await sharp(mask).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to measure rendered brand text')
  }

  return sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 3,
      background: color,
    },
  })
    .joinChannel(mask)
    .png()
    .toBuffer()
}

const faviconMaster = await squareIcon(820)
const appIconMaster = await squareIcon(700)
const faviconSizes = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    data: await resizePng(faviconMaster, size),
  })),
)

await Promise.all([
  writeFile(
    join(publicDir, 'favicon-16x16.png'),
    faviconSizes.find(({ size }) => size === 16).data,
  ),
  writeFile(
    join(publicDir, 'favicon-32x32.png'),
    faviconSizes.find(({ size }) => size === 32).data,
  ),
  writeFile(
    join(publicDir, 'favicon.png'),
    faviconSizes.find(({ size }) => size === 32).data,
  ),
  writeFile(join(publicDir, 'favicon.ico'), buildIco(faviconSizes)),
  writeFile(
    join(publicDir, 'apple-touch-icon.png'),
    await resizePng(appIconMaster, 180),
  ),
  writeFile(
    join(publicDir, 'android-chrome-192x192.png'),
    await resizePng(appIconMaster, 192),
  ),
  writeFile(
    join(publicDir, 'android-chrome-512x512.png'),
    await resizePng(appIconMaster, 512),
  ),
])

const landscapePng = await sharp(landscapePath, { density: 600 })
  .resize({ width: 640 })
  .png()
  .toBuffer()

await writeFile(
  join(brandDir, 'tanstack-landscape-black-640.png'),
  landscapePng,
)

// Raster emblems for the README header renderer (takumi takes raster data).
// Transparent background so one file works on either theme surface.
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

for (const [source, output] of [
  [emblemPath, 'tanstack-emblem-charcoal-256.png'],
  [creamEmblemPath, 'tanstack-emblem-cream-256.png'],
]) {
  const png = await sharp(source, { density: 1200 })
    .resize({
      width: 256,
      height: 256,
      fit: 'contain',
      background: transparent,
    })
    .png()
    .toBuffer()

  await writeFile(join(brandDir, output), png)
}

const ogLogo = await sharp(landscapePng).resize({ width: 360 }).png().toBuffer()
const ogHeadline = await renderText(
  'The open source\napplication stack\nfor the web',
  {
    color: colors.charcoal,
    dpi: 335,
    width: 560,
  },
)
const ogImage = await sharp(heroPath)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .composite([
    { input: ogLogo, left: 72, top: 56 },
    { input: ogHeadline, left: 72, top: 394 },
  ])
  .png({ compressionLevel: 9, palette: true })
  .toBuffer()

await Promise.all([
  writeFile(join(root, 'src', 'images', 'og.png'), ogImage),
  writeFile(join(root, 'src', 'images', 'og-light.png'), ogImage),
])

const outputs = [
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/favicon.ico',
  'public/favicon.png',
  'public/apple-touch-icon.png',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/images/brand/tanstack-landscape-black-640.png',
  'public/images/brand/tanstack-emblem-charcoal-256.png',
  'public/images/brand/tanstack-emblem-cream-256.png',
  'src/images/og.png',
  'src/images/og-light.png',
]

for (const output of outputs) {
  const data = await readFile(join(root, output))
  console.log(`${output} ${data.length} bytes`)
}
