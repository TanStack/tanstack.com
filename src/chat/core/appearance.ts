import { z } from 'zod'

export const themeModeSchema = z.enum(['system', 'light', 'dark'])
export const themePresetSchema = z.enum([
  'neutral',
  'midnight',
  'contrast',
  'lagoon',
  'orchid',
  'citrus',
  'ember',
])
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i)
export const themePaletteSchema = z.strictObject({
  background: colorSchema,
  surface: colorSchema,
  sidebar: colorSchema,
  soft: colorSchema,
  text: colorSchema,
  muted: colorSchema,
  line: colorSchema,
  accent: colorSchema,
  onAccent: colorSchema,
})
export const appearanceSchema = z.strictObject({
  mode: themeModeSchema,
  lightPreset: themePresetSchema,
  darkPreset: themePresetSchema,
  lightCustom: themePaletteSchema.nullable(),
  darkCustom: themePaletteSchema.nullable(),
  lightIntensity: z.number().min(0).max(100),
  darkIntensity: z.number().min(0).max(100),
  separatePalettes: z.boolean().optional(),
})
export type AppearancePreferences = z.infer<typeof appearanceSchema>
export type ThemePalette = z.infer<typeof themePaletteSchema>
export type ThemePreset = z.infer<typeof themePresetSchema>
export const defaultAppearance: AppearancePreferences = {
  mode: 'system',
  lightPreset: 'neutral',
  darkPreset: 'neutral',
  lightCustom: null,
  darkCustom: null,
  lightIntensity: 65,
  darkIntensity: 65,
}

export function usesSeparatePalettes(value: AppearancePreferences) {
  if (value.separatePalettes !== undefined) return value.separatePalettes
  return (
    value.lightPreset !== value.darkPreset ||
    value.lightCustom !== null ||
    value.darkCustom !== null ||
    value.lightIntensity !== value.darkIntensity
  )
}

export function choosePairedPreset(
  value: AppearancePreferences,
  preset: ThemePreset,
): AppearancePreferences {
  return {
    ...value,
    lightPreset: preset,
    darkPreset: preset,
    lightCustom: null,
    darkCustom: null,
    separatePalettes: false,
  }
}

const lightBase: ThemePalette = {
  background: '#fcfcfc',
  surface: '#ffffff',
  sidebar: '#fafafa',
  soft: '#f0f0f0',
  text: '#252525',
  muted: '#626262',
  line: '#e2e2e2',
  accent: '#303030',
  onAccent: '#ffffff',
}
const darkBase: ThemePalette = {
  background: '#111315',
  surface: '#262b33',
  sidebar: '#1b1d20',
  soft: '#323943',
  text: '#f0f2f5',
  muted: '#bbc2cd',
  line: '#48515d',
  accent: '#ecf0f4',
  onAccent: '#182029',
}
export const presets: Record<
  ThemePreset,
  { label: string; light: ThemePalette; dark: ThemePalette }
> = {
  neutral: { label: 'Neutral', light: lightBase, dark: darkBase },
  midnight: {
    label: 'Midnight',
    light: {
      ...lightBase,
      background: '#f4f6fa',
      sidebar: '#e8edf6',
      accent: '#314d85',
    },
    dark: {
      ...darkBase,
      background: '#0e1119',
      surface: '#181e2a',
      sidebar: '#141927',
      soft: '#252e3d',
      line: '#3a4658',
      accent: '#adc7ff',
    },
  },
  contrast: {
    label: 'High contrast',
    light: {
      ...lightBase,
      background: '#ffffff',
      sidebar: '#f1f1f1',
      soft: '#ebebeb',
      text: '#111111',
      muted: '#353535',
      line: '#555555',
      accent: '#173d87',
    },
    dark: {
      ...darkBase,
      background: '#080808',
      surface: '#151515',
      sidebar: '#101010',
      soft: '#252525',
      text: '#ffffff',
      muted: '#e0e0e0',
      line: '#a0a0a0',
      accent: '#f9db68',
      onAccent: '#16120a',
    },
  },
  lagoon: {
    label: 'Lagoon',
    light: {
      ...lightBase,
      background: '#f1faf9',
      sidebar: '#e4f3f0',
      soft: '#dcefeb',
      accent: '#17665d',
    },
    dark: {
      ...darkBase,
      background: '#102523',
      surface: '#1a302e',
      sidebar: '#152b29',
      soft: '#2a4541',
      line: '#44615c',
      accent: '#8de0ce',
    },
  },
  orchid: {
    label: 'Orchid',
    light: {
      ...lightBase,
      background: '#fbf7fc',
      sidebar: '#f2eaf6',
      soft: '#eee3f2',
      accent: '#73418c',
    },
    dark: {
      ...darkBase,
      background: '#241a2a',
      surface: '#302437',
      sidebar: '#291e30',
      soft: '#413149',
      line: '#614c69',
      accent: '#e5b5f4',
    },
  },
  citrus: {
    label: 'Citrus',
    light: {
      ...lightBase,
      background: '#fbfaf1',
      sidebar: '#f3f1db',
      soft: '#eeecd1',
      accent: '#626018',
    },
    dark: {
      ...darkBase,
      background: '#22251a',
      surface: '#2d3222',
      sidebar: '#282c1d',
      soft: '#3e452d',
      line: '#5c6545',
      accent: '#d9e693',
    },
  },
  ember: {
    label: 'Ember',
    light: {
      ...lightBase,
      background: '#fcf7f4',
      sidebar: '#f7eae3',
      soft: '#f2e3d9',
      accent: '#9a482c',
    },
    dark: {
      ...darkBase,
      background: '#291c1a',
      surface: '#352622',
      sidebar: '#2e211e',
      soft: '#49332d',
      line: '#694c42',
      accent: '#f4ba9d',
    },
  },
}
function channel(value: number) {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
export function contrast(a: string, b: string) {
  const lum = (s: string) =>
    0.2126 * channel(parseInt(s.slice(1, 3), 16)) +
    0.7152 * channel(parseInt(s.slice(3, 5), 16)) +
    0.0722 * channel(parseInt(s.slice(5, 7), 16))
  const x = lum(a),
    y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export function readablePalette(value: ThemePalette): ThemePalette {
  const p = { ...value }
  const surfaces = ['background', 'surface', 'sidebar', 'soft'] as const
  const minimum = (color: string) =>
    Math.min(...surfaces.map((key) => contrast(color, p[key])))
  if (minimum(p.text) < 4.5) {
    const dark = minimum('#101418')
    const light = minimum('#ffffff')
    p.text = dark >= light ? '#101418' : '#ffffff'
  }
  // A custom palette can mix very light and very dark surfaces. Keep the
  // background choice and pull incompatible secondary surfaces toward it.
  for (const key of surfaces) {
    if (contrast(p.text, p[key]) >= 4.5) continue
    for (let step = 1; step <= 20; step++) {
      const candidate = mix(p[key], p.background, step / 20)
      if (contrast(p.text, candidate) >= 4.5) {
        p[key] = candidate
        break
      }
    }
  }
  const mutedSurfaces = [p.background, p.surface, p.sidebar]
  if (mutedSurfaces.some((background) => contrast(p.muted, background) < 4.5))
    p.muted = p.text
  if (contrast(p.onAccent, p.accent) < 4.5)
    p.onAccent =
      contrast('#101418', p.accent) > contrast('#ffffff', p.accent)
        ? '#101418'
        : '#ffffff'
  return p
}
function mix(a: string, b: string, t: number) {
  const channels = [1, 3, 5].map((i) =>
    Math.round(
      parseInt(a.slice(i, i + 2), 16) * (1 - t) +
        parseInt(b.slice(i, i + 2), 16) * t,
    )
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${channels.join('')}`
}
export function resolvePalette(
  settings: AppearancePreferences,
  mode: 'light' | 'dark',
): ThemePalette {
  const base =
    presets[mode === 'light' ? settings.lightPreset : settings.darkPreset][mode]
  const custom = mode === 'light' ? settings.lightCustom : settings.darkCustom
  const intensity =
    (mode === 'light' ? settings.lightIntensity : settings.darkIntensity) / 100
  if (custom) return readablePalette(custom)
  if (
    (mode === 'light' ? settings.lightPreset : settings.darkPreset) ===
    'contrast'
  )
    return readablePalette(base)
  const neutral = presets.neutral[mode]
  return readablePalette({
    ...base,
    background: mix(neutral.background, base.background, intensity),
    surface: mix(neutral.surface, base.surface, intensity),
    sidebar: mix(neutral.sidebar, base.sidebar, intensity),
    soft: mix(neutral.soft, base.soft, intensity),
    line: mix(neutral.line, base.line, intensity),
  })
}
export function surprisePalette(mode: 'light' | 'dark'): ThemePalette {
  const choices = ['lagoon', 'orchid', 'citrus', 'ember'] as const
  const base =
    presets[choices[Math.floor(Math.random() * choices.length)]][mode]
  return readablePalette({
    ...base,
    accent:
      presets[choices[Math.floor(Math.random() * choices.length)]][mode].accent,
  })
}
