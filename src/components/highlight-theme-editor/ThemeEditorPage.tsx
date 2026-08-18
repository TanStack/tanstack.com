import * as React from 'react'
import { defaultHighlighter, type HighlightLanguage } from '@tanstack/highlight'
import {
  createThemeBaseCss,
  createThemeRule,
  themeTokenClasses,
  type HighlightTheme,
  type HighlightThemeToken,
} from '@tanstack/highlight/theme'
import { Select } from '~/components/Select'
import { CodeBlockView } from '~/components/markdown/CodeBlockView'
import { useToast } from '~/components/ToastProvider'
import { Button, FormInput } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import { useLocalStorage } from '~/utils/useLocalStorage'
import { languageOptions, themeEditorSnippets } from './snippets'
import {
  themePresets,
  tokenGroups,
  tokenLabels,
  type ThemePreset,
} from './tokenGroups'

const PREVIEW_SELECTOR = '[data-theme-editor-preview]'
const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

type Draft = {
  lang: HighlightLanguage
  presetId: string
  theme: HighlightTheme
}

const defaultPreset = themePresets[0]

const defaultDraft: Draft = {
  lang: 'ts',
  presetId: defaultPreset.id,
  theme: defaultPreset.theme,
}

export function ThemeEditorPage() {
  const [draft, setDraft] = useLocalStorage<Draft>(
    'highlight-theme-editor-draft',
    defaultDraft,
  )
  const { notify } = useToast()

  const { lang, presetId, theme } = draft

  const updateTheme = (updates: Partial<HighlightTheme>) => {
    setDraft((prev) => ({ ...prev, theme: { ...prev.theme, ...updates } }))
  }

  const updateToken = (token: HighlightThemeToken, value: string) => {
    setDraft((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        tokens: { ...prev.theme.tokens, [token]: value },
      },
    }))
  }

  const selectPreset = (preset: ThemePreset) => {
    setDraft((prev) => ({ ...prev, presetId: preset.id, theme: preset.theme }))
  }

  const previewCss = React.useMemo(
    () =>
      `${createThemeBaseCss()}\n\n${createThemeRule(PREVIEW_SELECTOR, theme)}`,
    [theme],
  )

  const codeBlock = React.useMemo(
    () =>
      defaultHighlighter.renderCodeBlockData({
        code: themeEditorSnippets[lang],
        lang,
        lineNumbers: true,
      }),
    [lang],
  )

  const copyThemeObject = async () => {
    try {
      await copyTextToClipboard(buildThemeObjectSnippet(theme))
      notify('Copied theme object to clipboard', { id: 'theme-copy' })
    } catch {
      notify('Failed to copy theme object', { id: 'theme-copy' })
    }
  }

  const copyAgentPrompt = async () => {
    try {
      await copyTextToClipboard(buildAgentPrompt(theme))
      notify('Copied AI prompt to clipboard', { id: 'theme-copy-prompt' })
    } catch {
      notify('Failed to copy AI prompt', { id: 'theme-copy-prompt' })
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-[380px_1fr] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Highlight Theme Editor</h1>

          <p className="mt-1 text-sm text-text-muted">
            Pick a language, tune every token, then copy the result out.
          </p>
        </div>

        <Field label="Start from">
          <Select
            selected={presetId}
            available={themePresets.map((preset) => ({
              label: preset.label,
              value: preset.id,
            }))}
            onSelect={(option) => {
              const preset = themePresets.find((p) => p.id === option.value)
              if (preset) selectPreset(preset)
            }}
          />
        </Field>

        <Field label="Language">
          <Select
            selected={lang}
            available={languageOptions}
            onSelect={(option) =>
              setDraft((prev) => ({ ...prev, lang: option.value }))
            }
          />
        </Field>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
          <legend className="px-1 text-sm font-semibold text-text-primary">
            Base
          </legend>
          <FormInput
            aria-label="Theme name"
            value={theme.name}
            onChange={(event) => updateTheme({ name: event.target.value })}
            placeholder="Theme name"
          />
          <ColorField
            label="Background"
            value={theme.background}
            onChange={(value) => updateTheme({ background: value })}
          />
          <ColorField
            label="Foreground"
            value={theme.foreground}
            onChange={(value) => updateTheme({ foreground: value })}
          />
          <ColorField
            label={tokenLabels.token}
            value={theme.tokens.token}
            onChange={(value) => updateToken('token', value)}
          />
        </fieldset>

        {tokenGroups.map((group) => (
          <fieldset
            key={group.id}
            className="flex flex-col gap-3 rounded-lg border border-border-default p-4"
          >
            <legend className="px-1 text-sm font-semibold text-text-primary">
              {group.label}
            </legend>
            {group.tokens.map((token) => (
              <ColorField
                key={token}
                label={tokenLabels[token]}
                value={theme.tokens[token]}
                onChange={(value) => updateToken(token, value)}
              />
            ))}
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={copyThemeObject}>
            Copy theme object
          </Button>

          <Button variant="secondary" size="sm" onClick={copyAgentPrompt}>
            Copy AI prompt
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-[calc(var(--navbar-height)+1.5rem)]">
        <style>{previewCss}</style>
        <div data-theme-editor-preview>
          <CodeBlockView
            copyText={codeBlock.copyText}
            htmlMarkup={codeBlock.htmlMarkup}
            lang={codeBlock.lang}
            title={`${theme.name || 'theme'}.${lang}`}
          />
        </div>
      </div>
    </div>
  )
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      {children}
    </label>
  )
}

function ColorField({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (next: string) => void
  value: string
}) {
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    setDraft(value)
  }, [value])

  const isValidDraft = HEX_PATTERN.test(draft)
  const swatchValue = isValidDraft ? normalizeHex(draft) : normalizeHex(value)

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={`${label} color`}
        type="color"
        value={swatchValue}
        onChange={(event) => {
          setDraft(event.target.value)
          onChange(event.target.value)
        }}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border-default bg-transparent p-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-text-muted">{label}</span>
        <FormInput
          aria-label={`${label} hex value`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (isValidDraft) onChange(normalizeHex(draft))
            else setDraft(value)
          }}
          className="h-7 px-2 py-0 font-mono text-xs"
          spellCheck={false}
        />
      </div>
    </div>
  )
}

function normalizeHex(value: string) {
  if (!HEX_PATTERN.test(value)) return '#000000'
  if (value.length === 4) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return value
}

function buildThemeObjectSnippet(theme: HighlightTheme) {
  const identifier = toThemeIdentifier(theme.name)
  const tokenLines = themeTokenClasses
    .map((token) => `    '${token}': ${JSON.stringify(theme.tokens[token])},`)
    .join('\n')

  return `import type { HighlightTheme } from '@tanstack/highlight/theme'

export const ${identifier} = {
  name: ${JSON.stringify(theme.name)},
  type: ${JSON.stringify(theme.type)},
  background: ${JSON.stringify(theme.background)},
  foreground: ${JSON.stringify(theme.foreground)},
  tokens: {
${tokenLines}
  },
} satisfies HighlightTheme
`
}

function buildAgentPrompt(theme: HighlightTheme) {
  return `Add this @tanstack/highlight theme to my project.

Find where this project configures @tanstack/highlight (look for a call to \`createThemeCss\` from '@tanstack/highlight/theme', usually near wherever the site's global styles are set up), and register the theme below there — as a new light/dark pair, or as an additional entry in a \`themes: [...]\` list, matching however the existing config is structured. Don't rewrite the surrounding setup beyond wiring this one in.

${buildThemeObjectSnippet(theme)}`
}

function toThemeIdentifier(name: string) {
  const words = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  const camel = words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
  return `${camel || 'custom'}Theme`
}
