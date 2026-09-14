import type { HighlightLanguage } from '@tanstack/highlight'

export const languageOptions: Array<{
  value: HighlightLanguage
  label: string
}> = [
  { value: 'ts', label: 'TypeScript' },
  { value: 'tsx', label: 'TSX' },
  { value: 'js', label: 'JavaScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsrx', label: 'TSRX (Octane)' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'yaml', label: 'YAML' },
  { value: 'toml', label: 'TOML' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'scheme', label: 'Scheme' },
  { value: 'shell', label: 'Shell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'apache', label: 'Apache' },
  { value: 'http', label: 'HTTP' },
  { value: 'env', label: 'Env' },
  { value: 'ejs', label: 'EJS' },
  { value: 'diff', label: 'Diff' },
  { value: 'plaintext', label: 'Plain Text' },
]

export const themeEditorSnippets: Record<HighlightLanguage, string> = {
  ts: `import { createThemeCss } from '@tanstack/highlight/theme'
import type { HighlightTheme } from '@tanstack/highlight/theme'

/** Merge overrides onto a complete base theme. */
export function extendTheme(
  base: HighlightTheme,
  overrides: Partial<HighlightTheme['tokens']>,
): HighlightTheme {
  const tokens = { ...base.tokens, ...overrides }
  const isValid = Object.keys(tokens).length > 0

  return isValid ? { ...base, tokens } : base
}

export const css = createThemeCss({ light: extendTheme(base, { keyword: '#ff79c6' }) })
`,
  tsx: `import * as React from 'react'

type SwatchProps = {
  label: string
  value: string
  onChange: (next: string) => void
}

export function Swatch({ label, value, onChange }: SwatchProps) {
  const [isFocused, setIsFocused] = React.useState(false)

  return (
    <label className="swatch" data-focused={isFocused}>
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
`,
  js: `export function debounce(fn, delayMs = 250) {
  let timeoutId = null

  return function debounced(...args) {
    if (timeoutId !== null) clearTimeout(timeoutId)
    console.log('scheduling', fn.name)
    timeoutId = setTimeout(() => fn.apply(this, args), delayMs)
  }
}

// Only fires once the user stops typing for 250ms
const onSearchInput = debounce((query) => fetchResults(query))
`,
  jsx: `function Avatar({ src, name }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')

  return src ? (
    <img className="avatar" src={src} alt={name} />
  ) : (
    <span className="avatar avatar--fallback">{initials}</span>
  )
}
`,
  tsrx: `import { Markdown } from '@tanstack/markdown/octane'

@for (post of posts) {
  <article>
    <h2>@{post.title}</h2>
    @if (post.description) {
      <Markdown>{post.description}</Markdown>
    } @else {
      <p>No description yet.</p>
    }
  </article>
}
`,
  json: `{
  "name": "@tanstack/highlight",
  "version": "0.0.10",
  "private": false,
  "sideEffects": false,
  "keywords": ["syntax-highlighting", "documentation"],
  "engines": {
    "node": ">=18"
  }
}
`,
  html: `<!-- theme-editor preview -->
<section class="card" data-state="active">
  <h2>Live preview</h2>
  <p>Pick a language, then tune every token below.</p>
  <button type="button" onclick="copyTheme()">Copy theme</button>
</section>
`,
  css: `/* Scoped to the preview panel only */
[data-theme-editor-preview] {
  --preview-radius: 0.75rem;
}

.th-code {
  border-radius: var(--preview-radius);
  font-size: 0.875rem;
}

.th-code:hover {
  outline: 2px solid var(--th-keyword);
}
`,
  vue: `<script setup lang="ts">
import { ref } from 'vue'

const theme = ref<'light' | 'dark'>('light')

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>

<template>
  <button @click="toggleTheme">
    Theme: {{ theme }}
  </button>
</template>
`,
  svelte: `<script>
  let count = 0

  function increment() {
    count += 1
  }
</script>

<button on:click={increment}>
  Clicked {count} {count === 1 ? 'time' : 'times'}
</button>

<style>
  button {
    font-weight: 600;
  }
</style>
`,
  markdown: `# Theme Editor

Pick a **language** on the left, then adjust any token below.

> [!TIP]
> Use \`createThemeCss\` to turn your picks into real CSS.

See the [themes guide](https://github.com/TanStack/highlight) for more.
`,
  mermaid: `sequenceDiagram
  participant Editor
  participant Highlighter
  participant Preview

  Editor->>Highlighter: highlightToHtml(snippet)
  Highlighter->>Preview: htmlMarkup
  Preview-->>Editor: rendered tokens
`,
  yaml: `# theme-editor.yaml
name: theme-editor
version: 1
enabled: true
tokens:
  keyword: "#cf222e"
  string: "#0a7f64"
  count: 20
`,
  toml: `# railway.toml
[deploy]
startCommand = "pnpm workflow:sweep"
cronSchedule = "*/5 * * * *"
restartPolicyType = "NEVER"
retries = 3
enabled = true
`,
  sql: `CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_dark INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

SELECT name, is_dark FROM themes WHERE is_dark = 1 ORDER BY created_at DESC;
`,
  python: `from dataclasses import dataclass

@dataclass
class Theme:
    name: str
    background: str
    is_dark: bool = False

def contrast_ratio(theme: Theme) -> float:
    # Placeholder — real formula lives in colorimetry.py
    return 4.5 if theme.is_dark else 7.0
`,
  scheme: `; sandbox policy for theme exports
(version 1)
(allow default)
(deny file-write* (subpath "/"))
(allow file-write* (subpath "/tmp/theme-editor"))
(define (clamp x lo hi) (max lo (min x hi)))
`,
  shell: `# Install the highlighter and preview it locally
npm install @tanstack/highlight

# Regenerate the compare report after editing themes
pnpm run report:compare -- --theme=$THEME_NAME
`,
  dockerfile: `# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
`,
  nginx: `server {
  listen 80;
  server_name theme-editor.example.com;
  root /var/www/theme-editor;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
`,
  apache: `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule . /index.html [L]
</IfModule>
`,
  http: `HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache
X-Theme-Id: github-light
`,
  env: `# .env.local
VITE_HIGHLIGHT_DEFAULT_THEME=github-light
VITE_HIGHLIGHT_DEFAULT_LANG=ts
`,
  ejs: `<!-- integration snippet -->
<% if (theme.isDark) { %>
<link rel="stylesheet" href="/themes/dark.css" />
<% } else { %>
<link rel="stylesheet" href="/themes/light.css" />
<% } %>
`,
  diff: `theme({
-  keyword: '#cf222e',
+  keyword: '#ff79c6',
-  background: '#ffffff',
+  background: '#282a36',
   comment: '#6e7781',
})
`,
  plaintext: `This language has no syntax rules, so every
character renders with the default "token" color
and background only — a good way to check contrast
before tuning the rest of the palette.
`,
}
