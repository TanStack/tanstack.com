// Slug-derived gradient used as a muted cover-image placeholder for blog
// posts that ship without a header image. Same input slug always renders
// the same gradient.

type Blob = {
  cx: number
  cy: number
  hue: number
  sat: number
  light: number
  size: number
  alpha: number
}

const PALETTES: Array<Array<[number, number, number]>> = [
  // indigo / violet / rose
  [
    [250, 35, 60],
    [280, 30, 58],
    [320, 28, 62],
    [220, 32, 55],
    [260, 35, 65],
  ],
  // teal / cyan / blue
  [
    [180, 32, 55],
    [200, 35, 60],
    [220, 32, 58],
    [170, 30, 60],
    [205, 35, 62],
  ],
  // ember — amber / orange / rose
  [
    [25, 38, 60],
    [10, 35, 60],
    [340, 32, 60],
    [40, 38, 62],
    [355, 35, 60],
  ],
  // forest / emerald / lime
  [
    [140, 30, 55],
    [160, 32, 55],
    [100, 28, 58],
    [180, 26, 55],
    [120, 30, 58],
  ],
  // dusk — purple / pink / coral
  [
    [300, 30, 62],
    [330, 32, 65],
    [350, 32, 65],
    [270, 28, 60],
    [315, 30, 62],
  ],
  // ocean — deep blue / cyan / aqua
  [
    [210, 35, 58],
    [195, 32, 60],
    [240, 30, 60],
    [180, 30, 58],
    [225, 32, 60],
  ],
  // sunset — gold / coral / magenta
  [
    [35, 38, 62],
    [10, 35, 62],
    [330, 30, 62],
    [50, 38, 65],
    [355, 32, 60],
  ],
  // moss — olive / sage / teal
  [
    [85, 25, 55],
    [120, 22, 55],
    [160, 25, 55],
    [60, 25, 58],
    [140, 22, 55],
  ],
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let s = seed || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

function blobsFor(slug: string): Array<Blob> {
  const seed = hash(slug || 'fallback')
  const rand = rng(seed)
  const palette = PALETTES[seed % PALETTES.length]
  return palette.map(([hue, sat, light]) => ({
    cx: 5 + rand() * 90,
    cy: 5 + rand() * 90,
    hue,
    sat,
    light,
    size: 55 + Math.floor(rand() * 25),
    alpha: 0.4 + rand() * 0.15,
  }))
}

function blobsToCss(blobs: Array<Blob>): string {
  return blobs
    .map(
      (b) =>
        `radial-gradient(circle at ${b.cx.toFixed(2)}% ${b.cy.toFixed(2)}%, hsla(${b.hue}, ${b.sat}%, ${b.light}%, ${b.alpha.toFixed(2)}) 0%, hsla(${b.hue}, ${b.sat}%, ${b.light}%, 0) ${b.size}%)`,
    )
    .join(', ')
}

export function gradientBackgroundCss(slug: string): string {
  return blobsToCss(blobsFor(slug))
}
