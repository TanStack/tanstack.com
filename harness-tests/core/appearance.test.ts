import { describe, expect, it } from 'vitest'
import {
  appearanceSchema,
  choosePairedPreset,
  contrast,
  defaultAppearance,
  presets,
  readablePalette,
  resolvePalette,
  usesSeparatePalettes,
} from '../../src/chat/core/appearance'

describe('appearance palettes', () => {
  it('keeps text readable in every preset and mode', () => {
    for (const preset of Object.keys(presets) as (keyof typeof presets)[])
      for (const mode of ['light', 'dark'] as const) {
        const palette = resolvePalette(
          { ...defaultAppearance, [`${mode}Preset`]: preset },
          mode,
        )
        expect(
          contrast(palette.text, palette.background),
        ).toBeGreaterThanOrEqual(4.5)
        expect(contrast(palette.muted, palette.surface)).toBeGreaterThanOrEqual(
          4.5,
        )
        expect(
          contrast(palette.onAccent, palette.accent),
        ).toBeGreaterThanOrEqual(4.5)
      }
  })
  it('corrects unreadable custom foregrounds without changing the chosen background', () => {
    const palette = readablePalette({
      ...presets.neutral.light,
      text: '#ffffff',
      muted: '#ffffff',
    })
    expect(palette.background).toBe(presets.neutral.light.background)
    expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(
      4.5,
    )
  })
  it('keeps text readable when custom surfaces disagree', () => {
    const palette = readablePalette({
      ...presets.neutral.dark,
      sidebar: '#ffffff',
      soft: '#fefefe',
    })
    expect(contrast(palette.text, palette.sidebar)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(palette.text, palette.soft)).toBeGreaterThanOrEqual(4.5)
  })
  it('rejects extra fields and invalid custom colors', () => {
    expect(
      appearanceSchema.safeParse({ ...defaultAppearance, mode: 'sepia' })
        .success,
    ).toBe(false)
    expect(
      appearanceSchema.safeParse({ ...defaultAppearance, unknown: 1 }).success,
    ).toBe(false)
    expect(
      appearanceSchema.safeParse({
        ...defaultAppearance,
        lightCustom: { ...presets.neutral.light, accent: 'red' },
      }).success,
    ).toBe(false)
  })
})

describe('paired theme choices', () => {
  it('pairs both palettes with one preset selection', () => {
    const next = choosePairedPreset(
      { ...defaultAppearance, darkPreset: 'contrast', separatePalettes: true },
      'lagoon',
    )
    expect(next.lightPreset).toBe('lagoon')
    expect(next.darkPreset).toBe('lagoon')
    expect(next.separatePalettes).toBe(false)
    expect(usesSeparatePalettes(next)).toBe(false)
  })
  it('keeps older distinct choices in the separate editor', () => {
    expect(
      usesSeparatePalettes({ ...defaultAppearance, darkPreset: 'contrast' }),
    ).toBe(true)
    expect(
      usesSeparatePalettes({
        ...defaultAppearance,
        lightCustom: presets.neutral.light,
      }),
    ).toBe(true)
    expect(usesSeparatePalettes(defaultAppearance)).toBe(false)
  })
})
