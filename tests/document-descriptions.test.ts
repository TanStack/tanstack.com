import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractFrontMatter } from '../src/utils/documents.server'

test('descriptions preserve linked prose without headings, images, or callout markers', () => {
  const result = extractFrontMatter(`---
title: Overview
---
# Overview

![Start logo](https://example.com/logo.png)

> [!NOTE]
> Build with [**TanStack Router**](https://tanstack.com/router) and \`createServerFn\`.

Use <strong>server-side</strong> rendering &amp; typed routes.

\`\`\`tsx
const implementationDetails = true
\`\`\`
`)

  assert.equal(
    result.data.description,
    'Build with TanStack Router and createServerFn. Use server-side rendering & typed routes.',
  )
  assert.match(result.excerpt, /^!\[Start logo\]/)
  assert.doesNotMatch(
    result.data.description,
    /logo|height:|implementationDetails/,
  )
})

test('descriptions preserve reference links, inline identifiers, and line breaks', () => {
  const result =
    extractFrontMatter(`Use [TanStack Query][query] with \`get_current_user\`.

Line one  
Line two.

[query]: https://tanstack.com/query
`)
  assert.equal(
    result.data.description,
    'Use TanStack Query with get_current_user. Line one Line two.',
  )
})

test('authored descriptions take precedence over generated excerpts', () => {
  const result = extractFrontMatter(`---
description: Learn how to deploy TanStack Start.
---
Unrelated opening paragraph.
`)
  assert.equal(result.data.description, 'Learn how to deploy TanStack Start.')
})

test('entity decoding preserves code type parameters and literal entity examples', () => {
  const result = extractFrontMatter(
    'Use `Array<T>` with &quot;quoted&quot; values, &#x1F680;, and literal `&amp;`.',
  )
  assert.equal(
    result.data.description,
    'Use Array<T> with "quoted" values, 🚀, and literal &amp;.',
  )
})

test('generated descriptions end on a word boundary', () => {
  const result = extractFrontMatter('Short words. '.repeat(30))
  assert.ok(result.data.description.length <= 203)
  assert.match(result.data.description, /(?:Short|words\.)\.\.\.$/)
})
