import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  OG_THEMES,
  getAccentColor,
  getThemeSurface,
  isOgTheme,
} from '../src/server/og/colors'

const SAMPLE_LIBRARY_IDS = [
  'start',
  'query',
  'table',
  'virtual',
  'workflow',
  'devtools',
] as const

test('OG accents follow the rebrand category palette', () => {
  assert.equal(getAccentColor('start'), '#39af46')
  assert.equal(getAccentColor('query'), '#d3481b')
  assert.equal(getAccentColor('table'), '#3aa3c4')
  assert.equal(getAccentColor('virtual'), '#ffa216')
  assert.equal(getAccentColor('workflow'), '#3e3529')
})

test('dark accents use the category 300 step', () => {
  assert.equal(getAccentColor('start', 'dark'), '#69bc75')
  assert.equal(getAccentColor('query', 'dark'), '#e06e49')
  assert.equal(getAccentColor('table', 'dark'), '#61adbf')
  assert.equal(getAccentColor('virtual', 'dark'), '#f4d648')
})

test('an explicit light theme matches the default', () => {
  for (const id of SAMPLE_LIBRARY_IDS) {
    assert.equal(getAccentColor(id, 'light'), getAccentColor(id))
  }
})

test('no dark accent collides with the text it sits beside', () => {
  // A category accent equal to the surface's secondary text flattens the
  // library name and its tagline into a single colour. This is why the dark
  // tooling accent uses the neutral *tint* step rather than the site's dark
  // tooling token, which is the same value as the dark secondary text.
  //
  // Light mode is deliberately not asserted: its tooling accent is already
  // #3e3529, the same as the light secondary text, so tooling banners are flat
  // in light mode today. Changing it would move the 1200x630 social cards too,
  // so it is left alone here rather than fixed as a side effect.
  const { secondaryText, background } = getThemeSurface('dark')

  for (const id of SAMPLE_LIBRARY_IDS) {
    const accent = getAccentColor(id, 'dark')
    assert.notEqual(accent, secondaryText, `${id} accent matches dark text`)
    assert.notEqual(accent, background, `${id} accent matches dark background`)
  }
})

test('every theme resolves a distinct surface', () => {
  const surfaces = OG_THEMES.map((theme) => getThemeSurface(theme))
  for (const surface of surfaces) {
    assert.notEqual(surface.background, surface.secondaryText)
  }
  assert.notEqual(surfaces[0].background, surfaces[1].background)
})

test('theme validation accepts only the rendered themes', () => {
  assert.ok(isOgTheme('light'))
  assert.ok(isOgTheme('dark'))
  assert.ok(!isOgTheme(''))
  assert.ok(!isOgTheme('Dark'))
  assert.ok(!isOgTheme('sepia'))
})
