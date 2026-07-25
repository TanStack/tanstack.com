---
title: 'Introducing TanStack Markdown and TanStack Highlight'
published: 2026-07-24
draft: false
excerpt: TanStack Markdown and TanStack Highlight are two tiny, synchronous libraries for turning technical content into deterministic, themeable webpages without shipping a general-purpose publishing system.
library: markdown, highlight
authors:
  - Tanner Linsley
---

![A braided river flows through dark mineral channels into a pale tropical sandbar](/blog-assets/introducing-tanstack-markdown-and-highlight/header.webp)

[Our last post about removing React Server Components from tanstack.com](/blog/we-removed-rsc-from-tanstack-com) ended with a pretty simple preference, I don't want to reach for an architecture to hide a dependency problem, I'd rather make the dependency small and let content be content.

TanStack Markdown and TanStack Highlight are the two libraries that made that decision possible, and we haven't properly introduced either of them yet.

We didn't set out to build two more TanStack libraries, we were trying to make one embarrassingly large part of tanstack.com small enough that we could stop designing the site around it. Earlier this year, a docs page was transferring about **1.1 MiB** of script, with roughly **358 KiB** tied to syntax highlighting alone. Shiki, its WASM and runtime pieces, themes, language chunks, and our Markdown pipeline had quietly turned reading a page into downloading a small publishing system.

RSC gave us a good way to keep that system on the server, and it worked, but the underlying cost was still there. We'd made an application architecture decision around hiding a dependency problem, and I couldn't stop asking why rendering the subset of Markdown and web code we actually use needed to be that expensive in the first place.

So we made the expensive part small.

Today we're releasing the first alphas of [TanStack Markdown](/markdown) and [TanStack Highlight](/highlight), two deliberately narrow libraries built around the content contract we actually need for technical blogs, documentation, and streamed AI output. The last post was about the architecture we could remove, this one is about what we built to remove it.

## Parsing and highlighting are different jobs

Markdown and syntax highlighting tend to arrive as one tangled pipeline. A parser finds a code fence, a plugin loads a grammar engine, the grammar engine loads themes, the renderer turns the whole thing into framework-specific output, and pretty soon changing how a link works means understanding half of a compiler toolchain.

TanStack Markdown parses content into a public, serializable document tree. TanStack Highlight turns known source languages into escaped, semantic HTML. Neither package imports the other, and the boundary between them is a normal callback carrying code, language, and fence metadata.

That separation is doing a lot of work for us. A Markdown document can be parsed, cached, indexed, inspected, or rendered without loading a highlighter, and a highlighter can be used for a code example that has never been near Markdown. If you connect them, you choose the language set and theme contract explicitly.

## The Markdown AST is ordinary data

Most Markdown APIs make the rendered output the product. TanStack Markdown treats the parsed document as the durable part.

```ts
import { parseMarkdown } from '@tanstack/markdown/parser'
import { renderHtml } from '@tanstack/markdown/html'

const document = parseMarkdown(source)
const cached = JSON.stringify(document)
const html = renderHtml(document)
```

The tree is plain objects and arrays, so it can cross a server boundary, sit in a cache, feed a search index, or render later through HTML, React, or Octane. Parsing doesn't trap the content inside a framework or an async plugin pipeline.

```tsx
import { Markdown } from '@tanstack/markdown/react'

export function Article({ source }: { source: string }) {
  return <Markdown>{source}</Markdown>
}
```

The parser is currently **4.9 KB gzipped**, the HTML renderer and framework adapters are about **6.7 KB gzipped**, and the package has zero runtime dependencies. React and Octane are optional peers behind their own entry points, while docs extensions, callouts, streaming behavior, and other transforms stay in separate imports.

That size comes from having an opinion about the job. TanStack Markdown supports the syntax we use across technical blogs and documentation, including headings, emphasis, lists, task lists, tables, footnotes, fenced code and metadata, links, images, references, and optional frontmatter. It does not promise every CommonMark edge case, arbitrary async plugin chains, automatic linkification, MDX evaluation, or a bundled sanitizer.

Raw HTML is escaped by default and executable URL protocols are removed, but this is still a rendering primitive, not a complete policy for untrusted content. Applications still own outbound link behavior, remote images, and what happens if they explicitly enable raw HTML.

## Stream the text, not parser state

AI output made another Markdown tradeoff feel more complicated than it needed to be. A lot of streaming renderers maintain incremental parser state as tokens arrive, which means the state has to survive updates, recover from partial syntax, and eventually agree with the completed document.

TanStack Markdown's optional streaming extension takes the accumulated response and reparses it synchronously on every UI update. Completed blocks stay deterministic, unfinished trailing headings, quotes, and list items don't leave empty placeholders behind, and there isn't any parser state to coordinate or throw away.

```tsx
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'
import { Markdown } from '@tanstack/markdown/react'

const extensions = [streamingMarkdownExtension()]

export function Response({ text }: { text: string }) {
  return (
    <Markdown extensions={extensions} frontmatter={false} headingIds={false}>
      {text}
    </Markdown>
  )
}
```

The extension adds about **0.2 KB gzipped** to the React path. For unusually long responses, you should still batch tiny transport tokens into sensible paint intervals, but the parser itself doesn't need a second streaming architecture.

## Highlight has no editor engine hiding inside it

Syntax highlighting for a webpage is a much smaller job than syntax highlighting for an editor.

An editor needs incremental parsing, huge language coverage, TextMate compatibility, semantic tokens, extension ecosystems, and enough state to update one character without touching the rest of the file. A docs page usually knows the language before rendering and needs compact, deterministic HTML that looks the same on the server and in the browser.

TanStack Highlight is built for that second job. Its empty core is **1.7 KB gzipped**, core plus TSX is **3.9 KB**, our nine-language docs set is **5.8 KB**, and the build containing all 25 shipped languages is about **8 KB**.

```ts
import { createHighlighter } from '@tanstack/highlight/core'
import { css } from '@tanstack/highlight/languages/css'
import { html } from '@tanstack/highlight/languages/html'
import { ts } from '@tanstack/highlight/languages/ts'
import { tsx } from '@tanstack/highlight/languages/tsx'

export const highlighter = createHighlighter({
  languages: [css, html, ts, tsx],
})

const result = highlighter.highlight(`const node = <Button />`, {
  lang: 'tsx',
})
```

There isn't an initialization promise, automatic language detection, or a hidden all-language registry. You import the languages your site uses, create the highlighter once, and share it between SSR and the browser. Unknown languages fall back to escaped plaintext instead of guessing.

Web languages also have a habit of containing other web languages, so the scanners can delegate embedded regions when you've registered the matching language. HTML can highlight a `<script>` or `<style>` body, Vue and Svelte can hand their script regions to TypeScript, and Markdown can highlight fenced code without making those nested grammars mandatory.

## One code tree, every theme

Our old setup generated a surprising amount of markup because token colors and theme decisions were baked into the output. Dark mode could mean another highlighted tree, another set of inline styles, or both.

TanStack Highlight emits one `<pre><code>` tree with stable `th-*` semantic classes and no inline colors. Themes are isolated imports that generate CSS variables, so changing from light to dark is a CSS operation and the source never needs another highlighting pass.

```ts
import { createThemeCss } from '@tanstack/highlight/theme'
import { githubDarkTheme } from '@tanstack/highlight/themes/github-dark'
import { githubLightTheme } from '@tanstack/highlight/themes/github-light'

const css = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  darkSelector: '.dark',
})
```

The renderer also understands the things documentation code blocks need around the tokens. Fence metadata and programmatic decorations can mark line highlights, insertions, deletions, focus, errors, warnings, exact character ranges, titles, and line numbers without introducing a transformer framework.

## Small libraries make the tests load-bearing

Coding agents made it practical for us to explore purpose-built parsers and scanners much faster than we could've justified a few years ago, but "AI wrote a smaller Markdown parser" isn't the bet here. Small software doesn't get to hand correctness to a giant dependency, which means the corpus, fixtures, size budgets, and output contracts become part of the product.

TanStack Highlight's committed corpus currently samples **333 fixtures from 2,940 TanStack documentation files**. Release checks cover token fidelity, deterministic HTML, package exports, bundle profiles, focused parser regressions, and a roughly 10,000-block throughput budget. Markdown tracks its supported CommonMark examples explicitly, checks renderer parity, and audits real TanStack and external content corpora.

The first tanstack.com migrations found edge cases in tight lists and image handling almost immediately. That's exactly what alpha software should surface, and every fix has to leave behind a focused regression test instead of another clever branch nobody can explain six months later.

The cost of going tiny is owning the contract. We want that cost in the repositories where everyone can inspect it.

## tanstack.com is the first production corpus

Both packages now power tanstack.com's docs and blog, and they were small enough to change an architecture decision we had already made.

Our RSC content pipeline existed largely to keep the old Markdown and highlighting stack out of the browser. Once the replacement renderer was about **27 KiB transferred** on the production routes we measured, regular SSR plus raw content data became the better trade for this site. We removed the content-specific RSC path, kept the original performance win, and made subsequent navigations smaller because the browser can reuse the renderer instead of receiving another serialized component tree.

The [RSC post](/blog/we-removed-rsc-from-tanstack-com) has the measurements and caveats behind that decision. For this announcement, the important part is that these aren't tiny libraries built around a benchmark toy, they're already carrying the messiest content corpus we own.

## Alpha means the contract can still move

Both libraries are available now:

```bash
pnpm add @tanstack/markdown @tanstack/highlight
```

The [Markdown docs](/markdown/latest/docs/overview) cover the supported syntax profile, renderers, extensions, security boundary, and AI streaming setup. The [Highlight docs](/highlight/latest/docs/overview) cover language registration, themes, annotations, Markdown adapters, and the output contract.

If you need every CommonMark edge case, hundreds of languages, TextMate fidelity, MDX evaluation, or an open-ended compiler ecosystem, these probably aren't replacements for the tools you already use. If you're rendering known technical content into webpages and the publishing stack has started to outweigh the page, try them, measure them against your own corpus, and bring us the cases our tests don't know yet.
