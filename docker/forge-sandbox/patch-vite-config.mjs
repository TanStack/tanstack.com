#!/usr/bin/env node
// Idempotently patches a scaffolded vite.config.ts so the dev server accepts
// requests proxied through the forge preview host: adds/merges
// `server: { host: true, allowedHosts: true }` into the object passed to
// `defineConfig(...)`.
//
// Usage: node patch-vite-config.mjs <path/to/vite.config.ts>
//
// No dependencies (the sandbox image doesn't guarantee a TypeScript parser
// is installed), so this uses careful brace-depth scanning instead of an AST.
// It only ever inserts text — it never rewrites or reformats code it doesn't
// need to touch, so running it twice is a no-op.

import fs from 'node:fs'

const filePath = process.argv[2]

if (!filePath) {
  console.error(
    'patch-vite-config: missing argument. Usage: node patch-vite-config.mjs <path/to/vite.config.ts>',
  )
  process.exit(1)
}

if (!fs.existsSync(filePath)) {
  console.error(`patch-vite-config: file not found: ${filePath}`)
  process.exit(1)
}

const source = fs.readFileSync(filePath, 'utf8')

/**
 * Finds the index of the `{` that opens the object literal passed as the
 * first argument to `defineConfig(`, and the index of its matching `}`.
 * Returns null if `defineConfig(...)` can't be located or its first
 * argument isn't an object literal (config shape we don't recognize).
 */
function findDefineConfigObjectRange(text) {
  const callMatch = text.match(/defineConfig\s*\(/)
  if (!callMatch) return null

  const afterCallParen = callMatch.index + callMatch[0].length
  // Skip whitespace to find the first argument.
  let i = afterCallParen
  while (i < text.length && /\s/.test(text[i])) i++

  if (text[i] !== '{') {
    // First arg isn't an inline object literal (e.g. a variable or a
    // function call) — not a shape we can safely merge into.
    return null
  }

  const objectStart = i
  const objectEnd = findMatchingBrace(text, objectStart)
  if (objectEnd === null) return null

  return { objectStart, objectEnd }
}

/** Given the index of an opening `{`, returns the index of its matching `}`. */
function findMatchingBrace(text, openIndex) {
  let depth = 0
  let inString = null // one of `'`, `"`, `` ` ``, or null
  let inLineComment = false
  let inBlockComment = false

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    const prev = text[i - 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (prev === '*' && ch === '/') inBlockComment = false
      continue
    }
    if (inString) {
      if (ch === '\\') {
        i++ // skip escaped char
        continue
      }
      if (ch === inString) inString = null
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLineComment = true
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      inBlockComment = true
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }

  return null
}

/**
 * Finds a top-level `server:` (or `server :`) key within the object body
 * (the text strictly between objectStart+1 and objectEnd), scanning only at
 * brace-depth 0 relative to that body so nested `server` keys in other
 * objects aren't matched. Returns the range of the server object's `{...}`
 * (braceStart/braceEnd), or null if no top-level `server` key exists.
 */
function findTopLevelServerBlock(text, bodyStart, bodyEnd) {
  let depth = 0
  let inString = null
  let inLineComment = false
  let inBlockComment = false

  const keyRegex = /\bserver\s*:/g

  for (let i = bodyStart; i < bodyEnd; i++) {
    const ch = text[i]
    const prev = text[i - 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (prev === '*' && ch === '/') inBlockComment = false
      continue
    }
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLineComment = true
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      inBlockComment = true
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }

    if (ch === '{' || ch === '(' || ch === '[') depth++
    if (ch === '}' || ch === ')' || ch === ']') depth--

    if (depth === 0) {
      keyRegex.lastIndex = i
      const match = keyRegex.exec(text)
      if (match && match.index === i) {
        // Found a top-level `server:` key. Find the `{` that starts its value.
        let j = i + match[0].length
        while (j < bodyEnd && /\s/.test(text[j])) j++
        if (text[j] !== '{') {
          // `server` value isn't an inline object — unrecognized shape.
          return { unrecognized: true }
        }
        const braceEnd = findMatchingBrace(text, j)
        if (braceEnd === null) return { unrecognized: true }
        return { keyStart: i, braceStart: j, braceEnd }
      }
    }
  }

  return null
}

/**
 * Checks whether a top-level key (e.g. `host` or `allowedHosts`) already
 * exists directly inside the object body spanning (bodyStart, bodyEnd)
 * (exclusive of the surrounding braces), ignoring nested objects/strings/comments.
 */
function hasTopLevelKey(text, bodyStart, bodyEnd, keyName) {
  let depth = 0
  let inString = null
  let inLineComment = false
  let inBlockComment = false
  const keyRegex = new RegExp(`\\b${keyName}\\s*:`)

  for (let i = bodyStart; i < bodyEnd; i++) {
    const ch = text[i]
    const prev = text[i - 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (prev === '*' && ch === '/') inBlockComment = false
      continue
    }
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }

    if (ch === '/' && text[i + 1] === '/') {
      inLineComment = true
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      inBlockComment = true
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }

    if (ch === '{' || ch === '(' || ch === '[') depth++
    if (ch === '}' || ch === ')' || ch === ']') depth--

    if (depth === 0 && keyRegex.test(text.slice(i, i + keyName.length + 8))) {
      const slice = text.slice(i)
      const m = slice.match(new RegExp(`^${keyName}\\s*:`))
      if (m) return true
    }
  }

  return false
}

/** Returns the indentation (leading whitespace) of the line containing index. */
function indentOfLineAt(text, index) {
  let lineStart = text.lastIndexOf('\n', index - 1) + 1
  let i = lineStart
  let indent = ''
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
    indent += text[i]
    i++
  }
  return indent
}

const configRange = findDefineConfigObjectRange(source)

if (!configRange) {
  console.error(
    `patch-vite-config: could not locate defineConfig({ ... }) with an inline object argument in ${filePath}. ` +
      'This script only knows how to patch that shape.',
  )
  process.exit(1)
}

const { objectStart, objectEnd } = configRange
const bodyStart = objectStart + 1
const bodyEnd = objectEnd

const serverBlock = findTopLevelServerBlock(source, bodyStart, bodyEnd)

if (serverBlock && serverBlock.unrecognized) {
  console.error(
    `patch-vite-config: found a top-level "server" key in ${filePath} but its value isn't an inline object literal. ` +
      'Refusing to guess how to merge — patch it by hand.',
  )
  process.exit(1)
}

let output = source

if (serverBlock) {
  // Merge host/allowedHosts into the existing server block.
  const { braceStart, braceEnd } = serverBlock
  const serverBodyStart = braceStart + 1
  const serverBodyEnd = braceEnd

  const hasHost = hasTopLevelKey(source, serverBodyStart, serverBodyEnd, 'host')
  const hasAllowedHosts = hasTopLevelKey(
    source,
    serverBodyStart,
    serverBodyEnd,
    'allowedHosts',
  )

  if (hasHost && hasAllowedHosts) {
    // Already patched — no-op, keep output === source.
  } else {
    const indent = indentOfLineAt(source, braceStart) + '  '
    const additions = []
    if (!hasAllowedHosts) additions.push(`${indent}allowedHosts: true,\n`)
    if (!hasHost) additions.push(`${indent}host: true,\n`)
    const insertion = additions.join('')

    // Insert right after the opening brace of the server block; the rest of
    // the original server body (and everything after it) follows unchanged.
    output =
      source.slice(0, serverBodyStart) +
      '\n' +
      insertion +
      source.slice(serverBodyStart)
  }
} else {
  // No top-level `server` key at all — add the whole block.
  const indent = indentOfLineAt(source, objectStart) + '  '
  const serverBlockText = `${indent}server: { host: true, allowedHosts: true },\n`

  output =
    source.slice(0, bodyStart) +
    '\n' +
    serverBlockText +
    source.slice(bodyStart)
}

if (output === source) {
  console.log(
    `patch-vite-config: ${filePath} already has server.host and server.allowedHosts — no changes made.`,
  )
  process.exit(0)
}

fs.writeFileSync(filePath, output, 'utf8')
console.log(`patch-vite-config: patched ${filePath}`)
