---
title: 'Lazy Tool Discovery: Scaling AI Tool Systems Without Drowning in Tokens'
published: 2026-03-12
excerpt: Every tool definition costs tokens and eats into the context window. Past a certain point it actually makes the model worse. Today we're shipping lazy tool discovery in TanStack AI.
authors:
  - Alem Tuzlak
---

![Lazy Tool Discovery](/blog-assets/tanstack-ai-lazy-tool-discovery/header.webp)

If you've built an AI-powered application with more than a handful of tools, you've probably hit the wall: every tool definition you send to the LLM costs tokens, eats into the context window, and — past a certain point — actually makes the model _worse_ at picking the right tool. More tools means more noise, slower responses, and higher bills.

Today we're shipping **lazy tool discovery** in TanStack AI, a mechanism that lets the LLM discover tools on demand instead of receiving all of them upfront.

## The Problem

Consider a customer support agent with 30 tools: ticket lookup, order management, refund processing, knowledge base search, escalation workflows, analytics queries, and more. On any given request, the user probably needs 2–3 of these. But the LLM sees all 30 tool definitions on every single call.

This creates three problems:

1. **Token waste.** Tool definitions with descriptions and JSON schemas add up fast. Thirty detailed tools can easily burn 3,000–5,000 tokens before the conversation even starts.
2. **Decision fatigue.** LLMs perform better with fewer, more relevant options. Research consistently shows that tool selection accuracy degrades as the number of available tools grows.
3. **Inflexibility.** You either send everything or build your own routing layer to pre-filter tools. Neither option is great.

## The Solution: `lazy: true`

Lazy tool discovery adds a single flag to tool definitions:

```typescript
const searchProducts = toolDefinition({
  name: 'searchProducts',
  description: 'Search products by keyword',
  inputSchema: z.object({
    query: z.string(),
  }),
  lazy: true,
})
```

That's it. Tools marked `lazy: true` are withheld from the LLM. In their place, the LLM sees a single synthetic tool called `__lazy__tool__discovery__` whose description lists the names of all available lazy tools.

When the LLM decides it needs a tool, the flow looks like this:

1. The LLM sees the discovery tool: _"You have access to additional tools: [searchProducts, compareProducts, calculateFinancing]"_
2. The LLM calls the discovery tool: `{ toolNames: ["searchProducts"] }`
3. The discovery tool returns the full description and JSON schema for `searchProducts`
4. `searchProducts` is injected as a normal tool in the next iteration
5. The LLM calls `searchProducts` directly with actual arguments

From the LLM's perspective, it asked about a tool, learned what it does, and then used it. From your perspective, you saved tokens on every request where that tool wasn't needed.

## How It Works Under the Hood

When you pass tools to `chat()`, the engine separates them into eager tools (the default) and lazy tools. A `LazyToolManager` class handles the rest:

- **Separation:** Eager tools are sent to the LLM immediately. Lazy tools are held back.
- **Discovery tool:** If any lazy tools exist, a synthetic discovery tool is created and included in the tool set. Its description contains the names of all lazy tools so the LLM knows what's available.
- **Dynamic injection:** When the LLM discovers a tool, it's added to the active tool set for the next agent loop iteration. The LLM then sees it as a regular tool with full schema — no proxy, no indirection.
- **Multi-turn memory:** On each `chat()` call, the manager scans the message history for previous discovery results. Tools discovered in earlier turns are automatically pre-populated — the LLM doesn't need to re-discover them.
- **Self-correction:** If the LLM tries to call a lazy tool it hasn't discovered yet (LLMs sometimes skip steps), it gets a helpful error: _"Tool 'searchProducts' must be discovered first. Call **lazy**tool**discovery** with toolNames: ['searchProducts'] to discover it."_ The LLM self-corrects on the next iteration.
- **Auto-cleanup:** When all lazy tools have been discovered, the discovery tool removes itself from the active set. No unnecessary clutter.

## Zero Overhead When Not Used

If none of your tools have `lazy: true`, the behavior is identical to before. No discovery tool is created, no extra processing happens, no code paths change. The feature is entirely opt-in.

## A Real Example

Here's a guitar store chat application with a mix of eager and lazy tools:

```typescript
import { chat, toolDefinition, maxIterations } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { z } from 'zod'

// Always available — core functionality
const getGuitars = toolDefinition({
  name: 'getGuitars',
  description: 'Get all guitars from inventory',
  inputSchema: z.object({}),
}).server(() => fetchGuitarsFromDB())

const recommendGuitar = toolDefinition({
  name: 'recommendGuitar',
  description: 'Display a guitar recommendation to the user',
  inputSchema: z.object({ id: z.number() }),
}).server(({ id }) => ({ id }))

// Discovered on demand — secondary features
const compareGuitars = toolDefinition({
  name: 'compareGuitars',
  description: 'Compare two or more guitars side by side',
  inputSchema: z.object({
    guitarIds: z.array(z.number()).min(2),
  }),
  lazy: true,
}).server(({ guitarIds }) => buildComparison(guitarIds))

const calculateFinancing = toolDefinition({
  name: 'calculateFinancing',
  description: 'Calculate monthly payment plans for a guitar',
  inputSchema: z.object({
    guitarId: z.number(),
    months: z.number(),
  }),
  lazy: true,
}).server(({ guitarId, months }) => computePaymentPlan(guitarId, months))

const searchGuitars = toolDefinition({
  name: 'searchGuitars',
  description: 'Search guitars by keyword in name or description',
  inputSchema: z.object({
    query: z.string(),
  }),
  lazy: true,
}).server(({ query }) => searchInventory(query))

// Use in chat — lazy tools work automatically
const stream = chat({
  adapter: openaiText('gpt-4o'),
  messages,
  tools: [
    getGuitars,
    recommendGuitar,
    compareGuitars,
    calculateFinancing,
    searchGuitars,
  ],
  agentLoopStrategy: maxIterations(20),
})
```

When a user asks _"recommend me a guitar"_, the LLM sees `getGuitars`, `recommendGuitar`, and `__lazy__tool__discovery__`. It calls the first two and never touches discovery. Tokens saved.

When a user asks _"compare the Motherboard Guitar and the Racing Guitar"_, the LLM sees the discovery tool, discovers `compareGuitars`, and calls it. One extra round-trip, but only when the feature is actually needed.

When a user follows up with _"how much would the cheaper one cost per month?"_, the LLM has `compareGuitars` already available (from the earlier discovery) and discovers `calculateFinancing`. The conversation builds naturally without re-discovering tools.

## When Should You Use It?

Lazy discovery makes sense when:

- **You have many tools** and most aren't needed in every conversation
- **Some tools are niche** — advanced search, analytics, admin functions, reporting
- **Tool descriptions are verbose** — detailed schemas with many properties
- **You're cost-conscious** — fewer tokens per request means lower bills

Keep tools eager (the default) when:

- They're called in most conversations
- The total tool count is small (under ~10)
- Latency is critical and the extra discovery round-trip matters

A good rule of thumb: if a tool is used in less than 30% of conversations, it's a strong candidate for `lazy: true`.

## What's Next

Lazy tool discovery is available now in `@tanstack/ai`. Add `lazy: true` to any tool definition and you're done.

We're exploring a few follow-on improvements:

- **Grouped discovery:** Discover related tools together (e.g., all analytics tools at once)
- **Cost tracking:** Surface token savings from lazy tools in DevTools
- **Smarter descriptions:** Let the discovery tool description include one-line summaries per lazy tool, not just names

Check out the [full documentation](https://tanstack.com/ai/latest/docs/guides/lazy-tool-discovery) for details, or try it out in the [ts-react-chat example](https://github.com/TanStack/ai/tree/main/examples/ts-react-chat) which includes three lazy tools with test prompts.

---

_TanStack AI is an open-source, provider-agnostic AI SDK for building type-safe AI applications. [Get started here.](https://tanstack.com/ai)_
