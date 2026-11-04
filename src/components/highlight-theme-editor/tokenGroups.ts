import { auroraXTheme } from '@tanstack/highlight/themes/aurora-x'
import { draculaTheme } from '@tanstack/highlight/themes/dracula'
import { githubDarkTheme } from '@tanstack/highlight/themes/github-dark'
import { githubLightTheme } from '@tanstack/highlight/themes/github-light'
import { monokaiTheme } from '@tanstack/highlight/themes/monokai'
import { nordTheme } from '@tanstack/highlight/themes/nord'
import { oneDarkProTheme } from '@tanstack/highlight/themes/one-dark-pro'
import { solarizedDarkTheme } from '@tanstack/highlight/themes/solarized-dark'
import { solarizedLightTheme } from '@tanstack/highlight/themes/solarized-light'
import type {
  HighlightTheme,
  HighlightThemeToken,
} from '@tanstack/highlight/theme'

export type TokenGroup = {
  id: string
  label: string
  tokens: ReadonlyArray<HighlightThemeToken>
}

export const tokenGroups: ReadonlyArray<TokenGroup> = [
  {
    id: 'syntax',
    label: 'Syntax',
    tokens: ['keyword', 'string', 'number', 'literal', 'operator', 'comment'],
  },
  {
    id: 'structure',
    label: 'Structure',
    tokens: ['function', 'type', 'property', 'variable'],
  },
  {
    id: 'markup',
    label: 'Markup',
    tokens: ['tag', 'attr', 'selector'],
  },
  {
    id: 'docs-and-diff',
    label: 'Docs & Diff',
    tokens: [
      'heading',
      'link',
      'code-inline',
      'inserted',
      'deleted',
      'meta',
      'command',
    ],
  },
]

export const tokenLabels: Record<HighlightThemeToken, string> = {
  token: 'Default text',
  attr: 'Attribute',
  'code-inline': 'Inline code',
  command: 'Command',
  comment: 'Comment',
  deleted: 'Deleted line',
  function: 'Function',
  heading: 'Heading',
  inserted: 'Inserted line',
  keyword: 'Keyword',
  link: 'Link',
  literal: 'Literal',
  meta: 'Meta',
  number: 'Number',
  operator: 'Operator',
  property: 'Property',
  selector: 'Selector',
  string: 'String',
  tag: 'Tag',
  type: 'Type',
  variable: 'Variable',
}

export type ThemePreset = {
  id: string
  label: string
  theme: HighlightTheme
}

export const themePresets: ReadonlyArray<ThemePreset> = [
  { id: 'github-light', label: 'GitHub Light', theme: githubLightTheme },
  { id: 'github-dark', label: 'GitHub Dark', theme: githubDarkTheme },
  { id: 'dracula', label: 'Dracula', theme: draculaTheme },
  { id: 'nord', label: 'Nord', theme: nordTheme },
  { id: 'monokai', label: 'Monokai', theme: monokaiTheme },
  { id: 'one-dark-pro', label: 'One Dark Pro', theme: oneDarkProTheme },
  { id: 'aurora-x', label: 'Aurora X', theme: auroraXTheme },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    theme: solarizedLightTheme,
  },
  { id: 'solarized-dark', label: 'Solarized Dark', theme: solarizedDarkTheme },
]
