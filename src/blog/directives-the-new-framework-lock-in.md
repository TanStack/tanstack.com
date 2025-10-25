---
title: Directives Are Becoming the New Framework Lock In
published: 2025-10-24
authors:
  - Tanner Linsley
---

![Directives Are Becoming the New Framework Lock In - A Quiet Problem in the JavaScript Ecosystem](/blog-assets/directives-the-new-framework-lock-in/header.png)

## A Quiet Problem in the JavaScript Ecosystem

For years, JavaScript has had exactly one meaningful directive, `"use strict"`. It is standardized, enforced by runtimes, and behaves the same in every environment. It represents a clear contract between the language, the engines, and developers.

But now we are watching a new trend emerge. Frameworks are inventing their own top level directives, `use client`, `use server`, `use cache`, `use workflow`, and more are appearing across the ecosystem. They look like language features. They sit where real language features sit. They affect how code is interpreted, bundled, and executed.

There is just one problem.

**They are not JavaScript.**

They are not standardized. Runtimes don't understand them. They have no governing specification. And each framework is free to define its own meaning, its own rules, and its own edge cases.

This might feel harmless or ergonomic today, but it carries long term consequences for the ecosystem, consequences we have seen before.

---

### When Directives Look Like the Platform, Developers Treat Them Like the Platform

A directive at the top of a file looks authoritative. It gives the impression of being a language level truth, not a framework hint. That creates a perception problem:

- Developers assume directives are official
- Ecosystems begin to treat them as a shared API surface
- New learners struggle to distinguish JavaScript from framework magic
- The boundary between platform and vendor blurs

We are already seeing confusion in the wild. Many developers now believe `use client` and `use server` are just how modern JavaScript works, unaware that they only exist inside specific build pipelines and server component semantics. That misunderstanding is a signal of a deeper issue.

---

### Credit where it's due: `use server` and `use client`

Some directives exist because multiple tools needed a single, simple coordination point. In practice, `use server` and `use client` are pragmatic shims that tell bundlers and runtimes where code is allowed to execute in an RSC world. They have seen relatively broad support across bundlers precisely because the scope is narrow: execution location.

That said, even these show the limits of directives once real-world needs appear. At scale, you often need parameters and policies that matter deeply to correctness and security: HTTP method, headers, middleware, auth context, tracing, caching behaviors, and more. Directives have no natural place to carry those options, which means they are frequently ignored, bolted on elsewhere, or re-encoded as new directive variants.

### The real offenders: option-laden directives and directive-adjacent APIs

When a directive immediately, or soon after creation, needs options or spawns siblings (e.g., `'use cache:remote'`) and helper calls like `cacheLife(...)`, that’s a strong signal the feature wants to be an API, not a string at the top of a file. If you know you need a function anyway, just use a function for all of it.

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

export const action = server(async (req) => {
  return new Response('ok')
}, {
  method: 'POST',
  headers: { 'x-foo': 'bar' },
  middleware: [requireAuth()],
})
```

APIs carry provenance (imports), versioning (packages), composition (functions), and testability. Directives don’t — and trying to smuggle options into them quickly becomes a design smell.

---

### A Shared Syntax Without a Shared Spec Is a Fragile Foundation

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

We already lived through this with decorators. TypeScript normalized a non standard semantics, the community built on top of it, then TC39 went in a different direction. Years of pain followed.

Why are we walking into the same trap again?

---

### “Isn’t this just a Babel plugin/macro with different syntax?”

Functionally, yes — both directives and custom transforms can change behavior at compile time. The issue isn’t capability; it’s surface and optics.

- Directives look like the platform. No import, no owner, no explicit source. They signal “this is JavaScript.”
- APIs/macros point to an owner. Imports provide provenance, versioning, and discoverability.

At best, a directive is equivalent to calling a global, importless function like `window.useCache()` at the top of your file. That’s exactly why it’s risky: it hides the provider and smuggles framework semantics into what looks like language.

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

### Directives Create an Ecosystem Arms Race

Once directives become a competitive surface, the incentives shift:

1. One vendor ships a new directive
2. It becomes a marketing feature
3. Developers expect it everywhere
4. Other frameworks feel forced to copy it
5. The pseudo standard spreads without a spec

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

Even durable tasks, caching strategies, and execution locations are now being encoded as directives. These are runtime semantics, not syntax semantics. Encoding them as directives is a form of platform creep, an attempt to define how developers think about capability boundaries using what looks like language grammar.

That is not harmless. That is direction setting outside the standards process.

---

### The Lock In Is Subtle, but Real

Even when there is no bad intent, directives create lock in by design:

- Mental lock in, developers form muscle memory around a vendor's directive semantics
- Tooling lock in, IDEs, bundlers, and compilers must target a specific runtime
- Code lock in, directives sit at the syntax level, making them costly to remove or migrate

Directives do not look proprietary, but they behave more proprietary than an API ever could, because they reshape the grammar of the ecosystem.

---

### If We Want Shared Primitives, We Should Collaborate, Not Fork the Language

There absolutely are real problems to solve:

- Server execution boundaries
- Streaming and async workflows
- Distributed runtime primitives
- Durable tasks
- Caching semantics

But those are problems for **APIs, capabilities, and future standards**, not for ungoverned pseudo syntax pushed through bundlers.

If multiple frameworks truly want shared primitives, the responsible path is:

- Collaborate on a cross framework spec
- Propose primitives to TC39 when appropriate
- Keep non standard features clearly scoped to API space, not language space

Directives should be rare, stable, and standardized, not multiplied by every vendor with a new idea.

---

### This is not the JSX/virtual DOM moment

It’s tempting to compare criticism of directives to the early skepticism around React’s JSX or the virtual DOM. I get the sentiment, but the failure modes are different. JSX and the VDOM did not masquerade as language features; they came with explicit imports, provenance, and tooling boundaries. Directives, by contrast, live at the top-level of files and look like the platform, which creates ecosystem expectations and tooling burdens without a shared spec.

---

### The Bottom Line

Framework directives might feel like DX magic today, but the current trend points toward a fractured future, JavaScript dialects defined not by standards, but by vendors.

We can do better.

If frameworks want to innovate, they should, but they should also clearly distinguish **framework behavior** from **platform semantics**, instead of blurring that line for short term adoption. The health of the ecosystem depends on it.
