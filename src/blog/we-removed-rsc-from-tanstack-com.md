---
title: 'We Removed React Server Components from TanStack.com'
published: 2026-06-23
draft: true
excerpt: RSC was the right fix when our markdown and highlighting stack was huge. Once we replaced that stack with tiny TanStack packages, regular SSR gave us the same performance profile with less code indirection.
library: start
authors:
  - Tanner Linsley
---

Earlier this year we moved the content-heavy parts of tanstack.com to React Server Components, wrote about it, measured it, and felt pretty good about the result. The browser stopped paying for our markdown pipeline and Shiki, docs and blog pages dropped a meaningful amount of JavaScript, and the story was clean enough that it became one of the obvious examples for why RSC can matter.

Then we moved tanstack.com back off RSC.

That sounds more dramatic than it is. I still think RSC is a good primitive, and I still like the way TanStack Start exposes it as something you can fetch, cache, stream, and render on your own terms. I'm not reversing that. This is a narrower story about our own site, our own dependency graph, and the slightly embarrassing thing we learned after replacing the biggest dependency behind the original win.

For tanstack.com, the best RSC use case was mostly compensating for the fact that our markdown and syntax highlighting stack had gotten too large.

## The original RSC win was real

The first performance pass that pushed us toward RSC came after we removed third-party ads from tanstack.com. Once the ad stack was gone, the remaining first-party cost was much easier to see, and docs were the obvious problem.

At the time, one docs page was transferring about **1.1 MiB** of script, with about **358 KiB** clearly tied to syntax highlighting alone, mostly Shiki, its runtime pieces, themes, and language chunks. Markdown was still in the client path too. The browser was downloading a docs rendering pipeline so it could read docs.

RSC fixed that in the most direct way possible. Render markdown and highlighted code on the server, send the result to the client as Flight data, and stop shipping the big renderer to every docs reader.

The numbers from the RSC post were real:

| Page type          | Client JS graph change |
| ------------------ | ---------------------: |
| Blog post pages    |        -153 KB gzipped |
| Docs pages         |        -153 KB gzipped |
| Docs example pages |         -40 KB gzipped |

The production pages moved too. The RSC launch post measured `/blog/react-server-components` going from **52 to 74** in Lighthouse, with Total Blocking Time dropping from **1,200ms to 260ms** and transfer size dropping from **1,101 KiB to 785 KiB**. `/router/latest/docs/overview` moved from **78 to 81**, with TBT dropping from **280ms to 200ms** and transfer size dropping from **917 KiB to 777 KiB**.

That was not fake. Heavy client work stopped shipping to the client, and the browser had less to do.

## Then markdown and highlighting got small

The second pass changed the premise. Instead of keeping the same heavy markdown and highlighting stack and using RSC to keep it off the client, we replaced that stack.

We moved the site to `@tanstack/markdown` and `@tanstack/highlight`, small packages built around the exact markdown and code rendering contract tanstack.com needs. The browser-relevant number is compressed transfer over the wire, and on the production comparison below, the explicit markdown/code renderer bucket is **26 KiB transferred** on both measured routes, about **18 to 19 KiB** more than the RSC version.

The package graph still explains why that became possible. We stopped depending on a general-purpose highlighting engine for a site that mostly needs predictable docs code blocks. We also stopped generating duplicate light and dark highlighted markup, stopped shipping inline token styles, and moved to class-based output with theme CSS.

Once that was true, RSC was no longer the only way to avoid the old markdown/highlight cost. Regular SSR could return raw markdown/source data through server functions, render with the tiny packages, and still keep the browser payload sane.

That is the part I did not expect to be quite this clear.

## Production is basically flat to better

After the migration back to regular SSR, we compared current production at `tanstack.com` against `old.tanstack.com`, which was still the RSC version during the measurement window. These are direct Lighthouse CLI mobile runs against production URLs, not local preview numbers.

| Page                            | Old RSC score | Current SSR score | Old TBT | Current TBT | Old bytes | Current bytes |
| ------------------------------- | ------------: | ----------------: | ------: | ----------: | --------: | ------------: |
| `/blog/react-server-components` |            56 |                63 |  234 ms |       90 ms | 1,085 KiB |     1,050 KiB |
| `/router/latest/docs/overview`  |            69 |                66 |  149 ms |      107 ms | 1,016 KiB |       995 KiB |

This is not a victory-lap Lighthouse table. The docs page score is a little lower, FCP/LCP moved around in the lab run, and I do not want to pretend Lighthouse variance is a product truth. But the byte and main-thread story is the one we were actually testing, and that part is clear enough: current SSR is not heavier than the old RSC version on the two routes that mattered most to the original RSC story.

The payload breakdown is even more useful.

| Bucket                 | Old RSC blog | Current blog | Blog delta | Old RSC docs | Current docs | Docs delta |
| ---------------------- | -----------: | -----------: | ---------: | -----------: | -----------: | ---------: |
| Document               |       99 KiB |       38 KiB |    -61 KiB |       86 KiB |       35 KiB |    -51 KiB |
| App JS/assets          |      517 KiB |      520 KiB |     +2 KiB |      533 KiB |      535 KiB |     +2 KiB |
| Markdown/code renderer |        8 KiB |       26 KiB |    +18 KiB |        7 KiB |       26 KiB |    +19 KiB |
| CSS                    |       47 KiB |       51 KiB |     +4 KiB |       47 KiB |       51 KiB |     +4 KiB |

So what more are we shipping? About **18 to 19 KiB** more explicit markdown/code-rendering chunks on these routes, plus a few KiB of CSS. The app JS bucket is basically flat. In exchange, the document is about **51 to 61 KiB** smaller because we are not sending the same shape of rendered Flight payload through the document path.

That trade is boring in the best way. The client gets a small renderer it can reuse across navigations, server functions return smaller raw content payloads, and the first load is flat to smaller.

## Long sessions changed the math too

The first-load story is only half of it. RSC looked best when the question was "can we keep this expensive renderer out of the first client bundle?" Once the renderer got small, the better question became "what happens after the first page?"

In the RSC version, content routes often carried rendered output in their server-function payloads. In the SSR version, those same requests carry raw markdown or source data, while the renderer is already sitting in the client bundle. That means the small renderer gets paid for once and reused, instead of transferring rendered content shapes again as you move around the site.

Local production payload checks showed that direction pretty clearly:

| Payload                      | RSC gzip | SSR gzip |   Delta |
| ---------------------------- | -------: | -------: | ------: |
| Query landing code example   |   4.6 KB |   0.0 KB | -4.6 KB |
| Router docs overview content |   5.2 KB |   3.7 KB | -1.5 KB |
| Router example initial file  |   5.6 KB |   1.5 KB | -4.1 KB |
| Heavy blog post content      |  15.0 KB |   9.4 KB | -5.6 KB |

That matters for docs. People do not always land on one page, read it, and leave. Our average visitor hits about six pages per session, which is exactly where this trade starts paying off. Shipping a tiny renderer once and then sending smaller content payloads across the rest of the session is a much more reasonable trade than it would have been when the renderer was Shiki plus the old markdown stack.

## The code got easier to explain

The performance result would have been enough by itself, but the codebase made the decision easier.

Our RSC version made the content path harder to trace than the feature needed. A docs or blog page was not "load markdown, render markdown." `fetchDocs` and `fetchBlogPost` called `renderMarkdownToRsc`, which rendered markdown into JSX in `processor.rsc.tsx`, then `renderRsc.tsx` wrapped that JSX in a fragment and called `renderServerComponent` to produce `contentRsc`.

The important part looked like this:

```tsx
import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as React from 'react'
import { renderMarkdownToJsx } from './processor.rsc'

export async function renderMarkdownToRsc(content: string) {
  const { content: contentJsx, headings } = await renderMarkdownToJsx(content)
  const contentRsc = await renderServerComponent(
    React.createElement(React.Fragment, null, contentJsx),
  )

  return {
    contentRsc,
    headings,
  }
}
```

That code is not offensive by itself. The problem was the shape it forced across the rest of the site. Route components received `contentRsc: React.ReactNode`, so the place that displayed the markdown was no longer the place that explained how markdown became markup. AI edits and human edits both had to know which files were normal React, which files were server-only React, which values were raw markdown, which values were Flight payloads, and which component tree was only visible after serialization.

The migration commit tells the story better than a rant would. In `92b1c481`, moving off RSC deleted or renamed the whole content-specific RSC path:

- `src/utils/markdown/processor.rsc.tsx`
- `src/utils/markdown/renderRsc.tsx`
- `src/components/markdown/CodeBlock.server.tsx`
- `src/components/markdown/renderCodeBlock.server.tsx`
- `src/utils/landing-code-example.functions.ts`
- `src/components/landing/LandingCodeExampleCard.server.tsx`
- `src/components/landing/codeExamples.server.tsx`
- `src/components/markdown/MarkdownHeadingContext.tsx`

The top-line diff is a bad headline because the same commit also added the first in-repo versions of the markdown and highlight packages. Counted by file bucket, the relevant parts looked like this:

| Bucket                              | Files | Added | Removed |
| ----------------------------------- | ----: | ----: | ------: |
| RSC-specific content plumbing       |     9 |    25 |     555 |
| Old markdown/rendering plugins      |     8 |     0 |     994 |
| New markdown/highlight package code |    21 | 3,610 |       0 |

The markdown/highlight code later moved out to packages. The useful part is the shape: the RSC-specific content path and old rendering plugins were real code, and once the renderer was small enough, most of that path no longer earned its keep.

## The framework APIs were not the problem

The TanStack Start RSC setup and helper APIs are not the villain here. They did what we asked them to do.

The annoying part was the extra app-specific work that accumulated around our particular content and dependency graph. Some of it was bundler configuration, some of it was dependency resolution, some of it was manual chunking, and none of it was wildly unreasonable in isolation. It just meant the content path kept picking up context that had nothing to do with writing or rendering content.

That is normal software gravity. Once a path crosses enough runtime boundaries, bundler boundaries, dependency boundaries, and serialization boundaries, small changes start needing extra context. The RSC APIs can be good and still be the wrong amount of machinery for a markdown pipeline that no longer needs to hide a huge dependency.

## Raw content over server functions

The current architecture is much easier to describe.

Server functions return content data. `MarkdownContent` receives a markdown document and renders a normal `Markdown` component. Landing examples are component data. Below-fold media-heavy sections still use targeted `Hydrate` timing so the browser does not eagerly schedule too much work on the first load.

The browser is still doing rendering work. That is the point of the trade. But it is doing a small, predictable amount of rendering work with packages we own, and the data moving through the app is closer to the source material again.

## The dependency was the architecture pressure

I do not think RSC was a mistake for tanstack.com. It solved the problem we had at the time. The mistake would be treating that successful workaround as permanent architecture after the underlying cost changed.

That is also where I think this story might resonate outside our repo. A lot of the best RSC examples are content-heavy, dependency-heavy, or both. Markdown, syntax highlighting, MDX, CMS transforms, content formatting, things that are expensive on the client and cacheable on the server. Those are legitimate uses. They are also the exact places where a smaller purpose-built dependency can change the tradeoff completely.

So if your app is using RSC to keep a giant renderer, parser, highlighter, formatter, or content pipeline out of the browser, that might be the right call. It was for us. But it is also worth asking whether the real problem is the client bundle, not the architecture.

For tanstack.com, once markdown and highlighting got small, regular SSR became the boring answer again. Fewer runtime boundaries, fewer special files, fewer bundler side quests, smaller or flat production payloads, and code that explains itself when you open the route.

RSC is still a good primitive. We just stopped using it to hide a dependency problem we no longer had.
