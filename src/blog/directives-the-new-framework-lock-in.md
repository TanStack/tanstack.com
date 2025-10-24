---
title: Directives Are Becoming the New Framework Lock In - A Quiet Problem in the JavaScript Ecosystem
published: 2025-10-24
authors:
  - Tanner Linsley
---

![Directives Are Becoming the New Framework Lock In - A Quiet Problem in the JavaScript Ecosystem](/blog-assets/directives-the-new-framework-lock-in/header.png)

For years, JavaScript has had exactly one meaningful directive, `"use strict"`. It is standardized, enforced by runtimes, and behaves the same in every environment. It represents a clear contract between the language, the engines, and developers.

But now we are watching a new trend emerge. Frameworks are inventing their own top level directives, `use client`, `use server`, `use cache`, `use workflow`, and more are appearing across the ecosystem. They look like language features. They sit where real language features sit. They affect how code is interpreted, bundled, and executed.

There is just one problem.

**They are not JavaScript.**

They are not standardized. Browsers do not understand them. They have no governing specification. And each framework is free to define its own meaning, its own rules, and its own edge cases.

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

### The Bottom Line

Framework directives might feel like DX magic today, but the current trend points toward a fractured future, JavaScript dialects defined not by standards, but by vendors.

We can do better.

If frameworks want to innovate, they should, but they should also clearly distinguish **framework behavior** from **platform semantics**, instead of blurring that line for short term adoption. The health of the ecosystem depends on it.
