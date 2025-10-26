---
title: Directives and the Platform Boundary
published: 2025-10-24
authors:
  - Tanner Linsley
description: A constructive look at framework directives, portability, and keeping a clear boundary between platform and library spaces.
---

![Header Image](/blog-assets/directives-and-the-platform-boundary/header.png)

## A Quiet Trend in the JavaScript Ecosystem

For years, JavaScript has had exactly one meaningful directive, `"use strict"`. It is standardized, enforced by runtimes, and behaves the same in every environment. It represents a clear contract between the language, the engines, and developers.

But now we are watching a new trend emerge. Frameworks are inventing their own top level directives, `use client`, `use server`, `use cache`, `use workflow`, and more are appearing across the ecosystem. They look like language features. They sit where real language features sit. They affect how code is interpreted, bundled, and executed.

There is an important distinction: these are not standardized JavaScript features. Runtimes don't understand them, there is no governing specification, and each framework is free to define its own meaning, rules, and edge cases.

This can feel ergonomic today, but it also increases confusion, complicates debugging, and imposes costs on tooling and portability, patterns we’ve seen before.

---

### When directives look like the platform, developers treat them like the platform

A directive at the top of a file looks authoritative. It gives the impression of being a language level truth, not a framework hint. That creates a perception problem:

- Developers assume directives are official
- Ecosystems begin to treat them as a shared API surface
- New learners struggle to distinguish JavaScript from framework magic
- The boundary between platform and vendor blurs
- Debuggability suffers and tooling must special‑case behaviors

We’ve already seen confusion. Many developers now believe `use client` and `use server` are just how modern JavaScript works, unaware that they only exist inside specific build pipelines and server component semantics. That misunderstanding signals a deeper issue.

---

### Credit where it's due: `use server` and `use client`

Some directives exist because multiple tools needed a single, simple coordination point. In practice, `use server` and `use client` are pragmatic shims that tell bundlers and runtimes where code is allowed to execute in an RSC world. They have seen relatively broad support across bundlers precisely because the scope is narrow: execution location.

That said, even these show the limits of directives once real-world needs appear. At scale, you often need parameters and policies that matter deeply to correctness and security: HTTP method, headers, middleware, auth context, tracing, caching behaviors, and more. Directives have no natural place to carry those options, which means they are frequently ignored, bolted on elsewhere, or re-encoded as new directive variants.

### Where directives start to strain: options and directive-adjacent APIs

When a directive immediately, or soon after creation, needs options or spawns siblings (e.g., `'use cache:remote'`) and helper calls like `cacheLife(...)`, that’s often a signal the feature wants to be an API, not a string at the top of a file. If you know you need a function anyway, just use a function for all of it.

Examples:

```js
'use cache:remote'
const fn = () => 'value'
```

```js
// explicit API with provenance and options
import { cache } from 'next/cache'
export const fn = cache(() => 'value', {
  strategy: 'remote',
  ttl: 60,
})
```

And for server behavior where details matter:

```js
import { server } from '@acme/runtime'

export const action = server(
  async (req) => {
    return new Response('ok')
  },
  {
    method: 'POST',
    headers: { 'x-foo': 'bar' },
    middleware: [requireAuth()],
  }
)
```

APIs carry provenance (imports), versioning (packages), composition (functions), and testability. Directives typically don’t, and trying to encode options into them can quickly become a design smell.

---

### Shared syntax without a shared spec can be a fragile foundation

Once multiple frameworks start adopting directives, we end up in the worst possible state:

| Category             | Shared Syntax | Shared Contract | Result                 |
| -------------------- | ------------- | --------------- | ---------------------- |
| ECMAScript           | ✅            | ✅              | Stable and universal   |
| Framework APIs       | ❌            | ❌              | Isolated and fine      |
| Framework Directives | ✅            | ❌              | Confusing and unstable |

A shared surface area without a shared definition creates:

- Interpretation drift, each framework defines its own semantics
- Portability issues, code that looks universal but is not
- Tooling burden, bundlers, linters, and IDEs must guess or chase behavior
- Platform friction, standards bodies get boxed in by ecosystem expectations

An example of where we've seen these struggles before is with decorators. TypeScript normalized a non standard semantics, the community built on top of it, then TC39 went in a different direction. This was and continues to be a painful migration for many.

---

### “Isn’t this just a Babel plugin/macro with different syntax?”

Functionally, yes. Both directives and custom transforms can change behavior at compile time. The issue isn’t capability; it’s surface and optics.

- Directives look like the platform. No import, no owner, no explicit source. They signal “this is JavaScript.”
- APIs/macros point to an owner. Imports provide provenance, versioning, and discoverability.

At best, a directive is equivalent to calling a global, importless function like `window.useCache()` at the top of your file. That’s exactly why it’s risky: it hides the provider and moves framework semantics into what looks like language.

Examples:

```js
'use cache'
const fn = () => 'value'
```

```js
// explicit API (imported, ownable, discoverable)
import { createServerFn } from '@acme/runtime'
export const fn = createServerFn(() => 'value')
```

```js
// global magic (importless, hidden provider)
window.useCache()
const fn = () => 'value'
```

Why this matters:

- Ownership and provenance: imports tell you who provides the behavior; directives do not.
- Tooling ergonomics: APIs live in package space; directives require ecosystem-wide special-casing.
- Portability and migration: replacing an imported API is straightforward; unwinding directive semantics across files is costly and ambiguous.
- Education and expectations: directives blur the platform boundary; APIs make the boundary explicit.

So while a custom Babel plugin or macro can implement the same underlying feature, the import-based API keeps it clearly in framework space. Directives move that same behavior into what looks like language space, which is the core concern of this post.

### “Does namespacing fix it?” (e.g., "use next.js cache")

Namespacing helps human discoverability, but it doesn’t address the core problems:

- It still looks like the platform. A top-level string literal implies language, not library.
- It still lacks provenance and versioning at the module level. Imports encode both; strings do not.
- It still requires special-casing across the toolchain (bundlers, linters, IDEs), rather than leveraging normal import resolution.
- It still encourages pseudo-standardization of syntax without a spec, just with vendor prefixes.
- It still increases migration cost compared to swapping an imported API.

Examples:

```js
'use next.js cache'
const fn = () => 'value'
```

```js
// explicit, ownable API with provenance and versioning
import { cache } from 'next/cache'
export const fn = cache(() => 'value')
```

If the goal is provenance, imports already solve that cleanly and work with today’s ecosystem. If the goal is a shared cross-framework primitive, that needs a real spec, not vendor strings that look like syntax.

---

### Directives can drive competitive dynamics

Once directives become a competitive surface, the incentives shift:

1. One vendor ships a new directive
2. It becomes a visible feature
3. Developers expect it everywhere
4. Other frameworks feel pressure to adopt it
5. The syntax spreads without a spec

This is how you get:

```tsx
'use server'
'use client'
'use cache'
'use cache:remote'
'use workflow'
'use streaming'
'use edge'
```

Even durable tasks, caching strategies, and execution locations are now being encoded as directives. These are runtime semantics, not syntax semantics. Encoding them as directives sets direction outside the standards process and merits caution.

---

### Considering APIs instead of directives for option‑rich features

Durable execution is a good example (e.g., `'use workflow'`, `'use step'`), but the point is general: directives can collapse behavior to a boolean, while many features benefit from options and room to evolve. Compilers and transforms can support either surface; this is about choosing the right one for longevity and clarity.

```js
'use workflow'
'use step'
```

One option: an explicit API with provenance and options:

```js
import { workflow, step } from '@workflows/workflow'

export const sendEmail = workflow(
  async (input) => {
    /* ... */
  },
  { retries: 3, timeout: '1m' }
)

export const handle = step(
  'fetchUser',
  async () => {
    /* ... */
  },
  { cache: 60 }
)
```

Function forms can be just as AST/transform‑friendly as directives, and they carry provenance (imports) and type‑safety.

Another option is to inject a global once and type it:

```ts
// bootstrap once
globalThis.workflow = createWorkflow()
// global types (e.g., global.d.ts)
declare global {
  var workflow: typeof import('@workflows/workflow').workflow
}
```

Usage stays API‑shaped, without directives:

```ts
export const task = workflow(
  async () => {
    /* ... */
  },
  { retries: 5 }
)
```

Compilers that extend ergonomics are great. Just look at JSX is a useful precedent! We just need to do it carefully and responsibly: extend via APIs with clear provenance and types, not top‑level strings that look like the language. These are options, not prescriptions.

---

### Subtle forms of lock‑in can emerge

Even when there is no bad intent, directives create lock in by design:

- Mental lock in, developers form muscle memory around a vendor's directive semantics
- Tooling lock in, IDEs, bundlers, and compilers must target a specific runtime
- Code lock in, directives sit at the syntax level, making them costly to remove or migrate

Directives may not look proprietary, but they can behave more like proprietary features than an API would, because they reshape the grammar of the ecosystem.

---

### If we want shared primitives, we should collaborate on specs and APIs

There absolutely are real problems to solve:

- Server execution boundaries
- Streaming and async workflows
- Distributed runtime primitives
- Durable tasks
- Caching semantics

But those are problems for **APIs, capabilities, and future standards**, not for ungoverned pseudo syntax pushed through bundlers.

If multiple frameworks truly want shared primitives, a responsible path is:

- Collaborate on a cross framework spec
- Propose primitives to TC39 when appropriate
- Keep non standard features clearly scoped to API space, not language space

Directives should be rare, stable, standardized and especially used judiciously rather than proliferating across vendors.

---

### Why this differs from the JSX/virtual DOM moment

It’s tempting to compare criticism of directives to the early skepticism around React’s JSX or the virtual DOM. The failure modes are different. JSX and the VDOM did not masquerade as language features; they came with explicit imports, provenance, and tooling boundaries. Directives, by contrast, live at the top-level of files and look like the platform, which creates ecosystem expectations and tooling burdens without a shared spec.

---

### The bottom line

Framework directives might feel like DX magic today, but the current trend risks a more fragmented future consisting of dialects defined not by standards, but by tools.

We can aim for clearer boundaries.

If frameworks want to innovate, they should, but they should also clearly distinguish **framework behavior** from **platform semantics**, instead of blurring that line for short term adoption. Clearer boundaries help the ecosystem.
