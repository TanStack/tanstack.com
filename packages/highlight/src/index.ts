export type HighlightLanguage =
  | 'apache'
  | 'css'
  | 'diff'
  | 'dockerfile'
  | 'ejs'
  | 'env'
  | 'html'
  | 'http'
  | 'js'
  | 'json'
  | 'jsx'
  | 'markdown'
  | 'mermaid'
  | 'nginx'
  | 'plaintext'
  | 'python'
  | 'scheme'
  | 'shell'
  | 'sql'
  | 'svelte'
  | 'toml'
  | 'ts'
  | 'tsx'
  | 'vue'
  | 'yaml'

export type HighlightOptions = {
  lang?: string
}

export type HighlightResult = {
  code: string
  html: string
  lang: HighlightLanguage
}

export type RenderCodeBlockOptions = HighlightOptions & {
  title?: string
}

export type RenderedCodeBlockData = {
  copyText: string
  htmlMarkup: string
  lang: HighlightLanguage
  title?: string
}

export type HighlightTokenClass =
  | 'attr'
  | 'code-inline'
  | 'command'
  | 'comment'
  | 'deleted'
  | 'function'
  | 'heading'
  | 'inserted'
  | 'keyword'
  | 'link'
  | 'literal'
  | 'meta'
  | 'number'
  | 'operator'
  | 'property'
  | 'selector'
  | 'string'
  | 'tag'
  | 'type'
  | 'variable'

export type HighlightToken = {
  className?: HighlightTokenClass
  value: string
}

export type HighlightTokenResult = {
  code: string
  lang: HighlightLanguage
  tokens: Array<HighlightToken>
}

type Pattern = {
  className: HighlightTokenClass
  regex: RegExp
  group?: number
}

type TokenRange = {
  start: number
  end: number
  className: HighlightTokenClass
}

const supportedLanguages = [
  'apache',
  'css',
  'diff',
  'dockerfile',
  'ejs',
  'env',
  'html',
  'http',
  'js',
  'json',
  'jsx',
  'markdown',
  'mermaid',
  'nginx',
  'plaintext',
  'python',
  'scheme',
  'shell',
  'sql',
  'svelte',
  'toml',
  'ts',
  'tsx',
  'vue',
  'yaml',
] as const satisfies ReadonlyArray<HighlightLanguage>

const languageAliases: Record<string, HighlightLanguage> = {
  '-->': 'plaintext',
  'angular-html': 'html',
  'angular-ts': 'ts',
  bash: 'shell',
  cjs: 'js',
  cmd: 'shell',
  console: 'shell',
  dotenv: 'env',
  htm: 'html',
  javascript: 'js',
  'js-vue': 'js',
  json5: 'json',
  jsonc: 'json',
  markdown: 'markdown',
  md: 'markdown',
  mjs: 'js',
  sh: 'shell',
  shell: 'shell',
  text: 'plaintext',
  ts: 'ts',
  typescript: 'ts',
  txt: 'plaintext',
  xml: 'html',
  yml: 'yaml',
  zsh: 'shell',
}

const jsKeywords =
  'as|async|await|break|case|catch|class|const|continue|default|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|interface|let|new|of|return|satisfies|switch|throw|try|type|typeof|var|while|yield'

const scriptPatterns: Array<Pattern> = [
  { className: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
  {
    className: 'string',
    regex: /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,
  },
  { className: 'function', regex: /@[A-Za-z_$][\w$]*/g },
  { className: 'keyword', regex: new RegExp(`\\b(?:${jsKeywords})\\b`, 'g') },
  { className: 'literal', regex: /\b(?:false|null|true|undefined)\b/g },
  {
    className: 'function',
    regex: /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    group: 1,
  },
  {
    className: 'function',
    regex: /(^|[^.A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*(?=\()/g,
    group: 2,
  },
  {
    className: 'type',
    regex:
      /\b(?:Array|Record|Promise|Readonly|Set|Map|string|number|boolean|unknown|never|void|any|[A-Z][A-Za-z0-9_$]*)\b/g,
  },
  { className: 'property', regex: /\.([A-Za-z_$][\w$]*)/g, group: 1 },
]

const jsxLikePatterns: Array<Pattern> = [
  { className: 'tag', regex: /<\/?\s*([A-Za-z][\w.-]*)/g, group: 1 },
  { className: 'attr', regex: /\s([:@A-Za-z_][\w:.-]*)(?=\s*=)/g, group: 1 },
  ...scriptPatterns,
]

const htmlLikePatterns: Array<Pattern> = [
  { className: 'comment', regex: /<!--[\s\S]*?-->/g },
  { className: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
  { className: 'tag', regex: /<\/?\s*([A-Za-z][\w:.-]*)/g, group: 1 },
  { className: 'attr', regex: /\s([:@A-Za-z_][\w:.-]*)(?=\s*=)/g, group: 1 },
]

const patternsByLanguage: Partial<Record<HighlightLanguage, Array<Pattern>>> = {
  apache: [
    { className: 'tag', regex: /<\/?\s*([A-Za-z][\w.-]*)/g, group: 1 },
    {
      className: 'keyword',
      regex: /\b(?:DocumentRoot|ServerName|VirtualHost)\b/g,
    },
    {
      className: 'string',
      regex: /\b(?:[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\*:\d+)\b/g,
    },
  ],
  css: [
    { className: 'comment', regex: /\/\*[\s\S]*?\*\//g },
    { className: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
    { className: 'variable', regex: /--[A-Za-z0-9_-]+/g },
    { className: 'selector', regex: /(^|\n)\s*([^{}\n]+)(?=\s*\{)/g, group: 2 },
    { className: 'property', regex: /[A-Za-z-]+(?=\s*:)/g },
    { className: 'function', regex: /\b[A-Za-z-]+(?=\()/g },
  ],
  diff: [
    { className: 'meta', regex: /^@@.*$/gm },
    { className: 'deleted', regex: /^-.*$/gm },
    { className: 'inserted', regex: /^\+.*$/gm },
  ],
  dockerfile: [
    { className: 'comment', regex: /^#.*$/gm },
    {
      className: 'keyword',
      regex:
        /^\s*(?:ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|LABEL|RUN|USER|VOLUME|WORKDIR)\b/gim,
    },
    { className: 'string', regex: /\b[A-Za-z0-9._/-]+:[A-Za-z0-9._-]+\b/g },
    { className: 'command', regex: /\b(?:bun|npm|pnpm|yarn|node)\b/g },
  ],
  ejs: [
    ...htmlLikePatterns,
    { className: 'keyword', regex: /\b(?:else|for|if|include|while)\b/g },
    { className: 'property', regex: /\.([A-Za-z_$][\w$]*)/g, group: 1 },
  ],
  env: [
    { className: 'comment', regex: /^#.*$/gm },
    { className: 'property', regex: /^[A-Za-z_][A-Za-z0-9_]*(?==)/gm },
    { className: 'string', regex: /=(.*)$/gm, group: 1 },
  ],
  html: htmlLikePatterns,
  http: [
    { className: 'keyword', regex: /^(?:DELETE|GET|PATCH|POST|PUT)\b/gm },
    { className: 'property', regex: /^[A-Za-z-]+(?=:)/gm },
    { className: 'string', regex: /(?:\/[^\s]*|[A-Za-z-]+\/[A-Za-z0-9.+-]+)/g },
  ],
  js: scriptPatterns,
  json: [
    { className: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g },
    { className: 'property', regex: /"((?:\\.|[^"\\])*)"\s*:/g, group: 1 },
    { className: 'string', regex: /"(?:\\.|[^"\\])*"/g },
    { className: 'literal', regex: /\b(?:false|null|true)\b/g },
    { className: 'number', regex: /-?\b\d+(?:\.\d+)?\b/g },
  ],
  jsx: jsxLikePatterns,
  markdown: [
    { className: 'heading', regex: /^#{1,6}\s.*$/gm },
    { className: 'code-inline', regex: /`[^`\n]+`/g },
    { className: 'link', regex: /\[[^\]]+\]\([^)]+\)/g },
  ],
  mermaid: [
    {
      className: 'keyword',
      regex:
        /^\s*(?:classDiagram|flowchart|graph|journey|sequenceDiagram|stateDiagram-v2)\b/gm,
    },
    { className: 'operator', regex: /-->|---|==>|-.->/g },
  ],
  nginx: [
    { className: 'comment', regex: /#.*$/gm },
    {
      className: 'keyword',
      regex:
        /\b(?:events|http|listen|location|proxy_pass|server|server_name|upstream)\b/g,
    },
    { className: 'number', regex: /\b\d+\b/g },
    { className: 'string', regex: /(?:\/[^\s;{}]*|https?:\/\/[^\s;{}]+)/g },
  ],
  python: [
    { className: 'comment', regex: /#[^\n]*/g },
    { className: 'string', regex: /f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*'/g },
    {
      className: 'keyword',
      regex:
        /\b(?:as|class|def|elif|else|except|for|from|if|import|in|lambda|pass|return|try|while|with|yield)\b/g,
    },
    { className: 'function', regex: /\bdef\s+([A-Za-z_][\w]*)/g, group: 1 },
    { className: 'type', regex: /\b(?:bool|dict|float|int|list|str|tuple)\b/g },
  ],
  scheme: [
    { className: 'string', regex: /"(?:\\.|[^"\\])*"/g },
    { className: 'keyword', regex: /\b(?:define|lambda|let|if|cond|else)\b/g },
    {
      className: 'function',
      regex: /\(define\s+\(([A-Za-z_+\-*/<>=!?][\w+\-*/<>=!?]*)/g,
      group: 1,
    },
  ],
  shell: [
    { className: 'comment', regex: /^#!.*$|#.*$/gm },
    { className: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
    {
      className: 'variable',
      regex: /\$[A-Za-z_][A-Za-z0-9_]*|\b[A-Z_][A-Z0-9_]*(?==)/g,
    },
    {
      className: 'keyword',
      regex:
        /\b(?:case|do|done|elif|else|esac|export|fi|for|function|if|in|then|while)\b/g,
    },
    {
      className: 'command',
      regex: /(^|\n)\s*([A-Za-z0-9_./-]+)(?=\s|$)/g,
      group: 2,
    },
  ],
  sql: [
    { className: 'comment', regex: /--[^\n]*|\/\*[\s\S]*?\*\//g },
    { className: 'string', regex: /'(?:''|[^'])*'/g },
    {
      className: 'keyword',
      regex:
        /\b(?:and|as|by|delete|from|group|insert|join|limit|order|select|set|update|values|where)\b/gi,
    },
    { className: 'literal', regex: /\b(?:false|null|true)\b/gi },
  ],
  svelte: [...htmlLikePatterns, ...scriptPatterns],
  toml: [
    { className: 'heading', regex: /^\s*\[[^\]]+\]/gm },
    { className: 'property', regex: /^[A-Za-z0-9_.-]+(?=\s*=)/gm },
    { className: 'string', regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
    { className: 'literal', regex: /\b(?:false|true|\d+(?:\.\d+)?)\b/g },
  ],
  ts: scriptPatterns,
  tsx: jsxLikePatterns,
  vue: [...htmlLikePatterns, ...scriptPatterns],
  yaml: [
    { className: 'comment', regex: /#.*$/gm },
    { className: 'property', regex: /^[ \t-]*[A-Za-z0-9_.-]+(?=\s*:)/gm },
    { className: 'string', regex: /:\s*([^\n#]+)$/gm, group: 1 },
  ],
}

export function normalizeLanguage(lang?: string): HighlightLanguage {
  const normalized = (lang || 'plaintext').trim().toLowerCase()

  if (isSupportedLanguage(normalized)) {
    return normalized
  }

  return languageAliases[normalized] || 'plaintext'
}

export function listLanguages(): Array<HighlightLanguage> {
  return [...supportedLanguages]
}

export function highlight(
  code: string,
  options: HighlightOptions = {},
): HighlightResult {
  const result = tokenize(code, options)
  const innerHtml = renderTokensToHtml(result.tokens)

  return {
    code,
    html: `<pre class="th-code th-code--${result.lang}" data-language="${result.lang}"><code>${innerHtml}</code></pre>`,
    lang: result.lang,
  }
}

export function highlightToHtml(code: string, options: HighlightOptions = {}) {
  return highlight(code, options).html
}

export function tokenize(
  code: string,
  options: HighlightOptions = {},
): HighlightTokenResult {
  const lang = normalizeLanguage(options.lang)

  return {
    code,
    lang,
    tokens:
      lang === 'plaintext'
        ? [{ value: code }]
        : collectTokens(
            code,
            collectRanges(code, patternsByLanguage[lang] || []),
          ),
  }
}

export function renderCodeBlockData({
  code,
  lang,
  title,
}: {
  code: string
  lang?: string
  title?: string
}): RenderedCodeBlockData {
  const copyText = code.trimEnd()

  return {
    copyText,
    htmlMarkup: highlightToHtml(copyText, { lang }),
    lang: normalizeLanguage(lang),
    title,
  }
}

export function createThemeCss() {
  return `:root {
  --th-token: inherit;
  --th-keyword: #cf222e;
  --th-string: #0a7f64;
  --th-comment: #6e7781;
  --th-function: #8250df;
  --th-type: #953800;
  --th-property: #0550ae;
  --th-tag: #116329;
  --th-attr: #0550ae;
  --th-literal: #0550ae;
  --th-number: #0550ae;
  --th-variable: #953800;
  --th-operator: #8250df;
  --th-inserted: #1a7f37;
  --th-deleted: #cf222e;
  --th-meta: #57606a;
  --th-heading: #0550ae;
  --th-link: #0969da;
  --th-code-inline: #953800;
  --th-selector: #116329;
  --th-command: #8250df;
}

.dark {
  --th-keyword: #ff7b72;
  --th-string: #a5d6ff;
  --th-comment: #8b949e;
  --th-function: #d2a8ff;
  --th-type: #ffa657;
  --th-property: #79c0ff;
  --th-tag: #7ee787;
  --th-attr: #79c0ff;
  --th-literal: #79c0ff;
  --th-number: #79c0ff;
  --th-variable: #ffa657;
  --th-operator: #d2a8ff;
  --th-inserted: #7ee787;
  --th-deleted: #ff7b72;
  --th-meta: #8b949e;
  --th-heading: #79c0ff;
  --th-link: #58a6ff;
  --th-code-inline: #ffa657;
  --th-selector: #7ee787;
  --th-command: #d2a8ff;
}

.th-token { color: var(--th-token); }
.th-keyword { color: var(--th-keyword); }
.th-string { color: var(--th-string); }
.th-comment { color: var(--th-comment); }
.th-function { color: var(--th-function); }
.th-type { color: var(--th-type); }
.th-property { color: var(--th-property); }
.th-tag { color: var(--th-tag); }
.th-attr { color: var(--th-attr); }
.th-literal { color: var(--th-literal); }
.th-number { color: var(--th-number); }
.th-variable { color: var(--th-variable); }
.th-operator { color: var(--th-operator); }
.th-inserted { color: var(--th-inserted); }
.th-deleted { color: var(--th-deleted); }
.th-meta { color: var(--th-meta); }
.th-heading { color: var(--th-heading); }
.th-link { color: var(--th-link); }
.th-code-inline { color: var(--th-code-inline); }
.th-selector { color: var(--th-selector); }
.th-command { color: var(--th-command); }`
}

function collectTokens(code: string, ranges: Array<TokenRange>) {
  const tokens: Array<HighlightToken> = []
  let index = 0

  for (const range of ranges) {
    if (range.start > index) {
      tokens.push({ value: code.slice(index, range.start) })
    }

    tokens.push({
      className: range.className,
      value: code.slice(range.start, range.end),
    })
    index = range.end
  }

  if (index < code.length) {
    tokens.push({ value: code.slice(index) })
  }

  return tokens
}

function renderTokensToHtml(tokens: Array<HighlightToken>) {
  let html = ''

  for (const token of tokens) {
    const value = escapeHtml(token.value)
    html += token.className
      ? `<span class="th-token th-${token.className}">${value}</span>`
      : value
  }

  return html
}

function collectRanges(code: string, patterns: Array<Pattern>) {
  const ranges: Array<TokenRange> = []
  const occupied = new Uint8Array(code.length)

  for (const pattern of patterns) {
    const regex = cloneRegex(pattern.regex)
    let match: RegExpExecArray | null

    while ((match = regex.exec(code))) {
      const value = pattern.group ? match[pattern.group] : match[0]
      if (!value) {
        if (match[0].length === 0) regex.lastIndex++
        continue
      }

      const fullStart = match.index
      const groupOffset = pattern.group ? match[0].indexOf(value) : 0
      const start = fullStart + groupOffset
      const end = start + value.length

      if (start === end || hasOverlap(occupied, start, end)) continue

      ranges.push({ start, end, className: pattern.className })
      occupied.fill(1, start, end)
    }
  }

  return ranges.sort((a, b) => a.start - b.start || a.end - b.end)
}

function hasOverlap(occupied: Uint8Array, start: number, end: number) {
  for (let index = start; index < end; index++) {
    if (occupied[index]) return true
  }

  return false
}

function cloneRegex(regex: RegExp) {
  return new RegExp(
    regex.source,
    regex.flags.includes('g') ? regex.flags : `${regex.flags}g`,
  )
}

function isSupportedLanguage(lang: string): lang is HighlightLanguage {
  return (supportedLanguages as ReadonlyArray<string>).includes(lang)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
