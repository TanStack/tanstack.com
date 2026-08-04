const SHOP_PRODUCT_COLORS: Record<string, string> = {
  black: '#0a0a0a',
  white: '#f5f5f0',
  cream: '#e4dcc4',
  bone: '#e4dcc4',
  natural: '#ddd3b8',
  vintage: '#e8e0d0',
  fog: '#c9c6ba',
  sand: '#c8b97a',
  ink: '#16130d',
  navy: '#1a2e50',
  slate: '#2e3339',
  olive: '#5a5a3a',
  rust: '#b84a27',
  red: '#c41d1d',
  blue: '#1d4ed8',
  sea: '#3a5d66',
  green: '#15803d',
  gray: '#6b7280',
  grey: '#6b7280',
  charcoal: '#3a3a3c',
  heather: '#8a8a9a',
  denim: '#1a4569',
  brown: '#6b3a2a',
  pink: '#e8749a',
  purple: '#7c3aed',
  yellow: '#ca8a04',
  orange: '#c2410c',
  royal: '#4169e1',
  kelly: '#4daa59',
  aqua: '#00c4d4',
  rose: '#c8818a',
  dusty: '#c8818a',
  coral: '#e8756a',
  maroon: '#800020',
  forest: '#228b22',
  teal: '#0d9488',
  lavender: '#967bb6',
  lilac: '#967bb6',
  tan: '#d2b48c',
  ivory: '#fffff0',
  gold: '#c9a227',
  silver: '#a8a9ad',
  ash: '#b2bec3',
  stone: '#78716c',
  moss: '#6b7c55',
  sage: '#87a878',
  sky: '#0ea5e9',
  midnight: '#1e1b4b',
  espresso: '#3c1f0f',
  mixed: '#ef4c7a',
  holo: '#d6e7ff',
  polished: '#c5b07a',
  blend: '#e8e0d0',
}

export function resolveShopProductColor(name: string): string | undefined {
  const tokens = name
    .toLowerCase()
    .split(/[\s_-]+/)
    .reverse()
  for (const token of tokens) {
    if (SHOP_PRODUCT_COLORS[token]) return SHOP_PRODUCT_COLORS[token]
  }
  return undefined
}

export function shopColorContrast(hex: string): '#111111' | '#ffffff' {
  const value = hex.replace('#', '')
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.55
    ? '#111111'
    : '#ffffff'
}

export function shopColorWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
