---
title: 'Code Mode: Let Your AI Write Programs, Not Just Call Tools'
published: 2026-04-08
excerpt: One tool call at a time is the bottleneck. TanStack AI Code Mode lets the LLM write and execute TypeScript programs in secure sandboxes, composing your tools with loops, conditionals, and Promise.all in a single shot.
authors:
  - Jack Herrington
  - Alem Tuzlak
  - Tanner Linsley
---

![TanStack AI Code Mode](/blog-assets/tanstack-ai-code-mode/header.jpg)

There are three things we know about LLMs and tools:

1. **Tool calling is slow and expensive.** Every tool call means a round-trip. The calls themselves, their parameters, and their return values all bloat the context window, which bloats the token count on every subsequent request. Even when calls can be parallelized, the overhead compounds.
2. **LLMs are hilariously bad at math.** Ask a model to sum a column of numbers from three API responses and you'll get a confident, but probably incorrect answer.
3. **Frontier LLMs are very good at writing TypeScript.** They have an enormous amount of real-world TypeScript in their training data. They know how to `Promise.all`, `.reduce()`, `.filter()`, and handle async control flow.

Put these together and they point in one direction: let the LLM do what it's good at (write TypeScript), and let a runtime handle what it's bad at (execution, math, orchestration).

That's exactly what **Code Mode** is. Code mode gives the LLM an `execute_typescript` tool. Instead of orchestrating tools one at a time, the model writes a short TypeScript program that composes your tools with loops, conditionals, and data transformations, then executes it in a secure sandbox. One call in, one structured result out.

If you've tried to connect an LLM to your APIs, you know the pain. The model has no concept of N+1 problems. It will happily fetch a list of 50 users, then make 50 individual requests to get each user's profile. It doesn't batch. It doesn't parallelize. It doesn't know how to aggregate results without burning a reasoning step per intermediate value.

Code Mode hands those problems to TypeScript. The model writes `Promise.all` to batch API calls. It uses `.reduce()` to aggregate instead of asking the LLM to reason about each value. Math happens in the JavaScript runtime, not in the model's token prediction. **The N+1 problem disappears. The arithmetic is correct. Every time.**

This is a game changer for any application that wants to put an LLM in front of real APIs.

## Prior Art: Why Code Execution Matters

We're not the first to recognize this pattern.

**Anthropic's computer use and tool-use research** has shown that LLMs are dramatically more capable when they can write and execute code rather than being limited to predefined tool signatures. Their work on Claude's analysis tool demonstrated that giving models a code sandbox reduces error rates and increases task completion on complex multi-step problems.

**Cloudflare coined the term "Code Mode"** in [their September 2025 blog post](https://blog.cloudflare.com/code-mode/) by Kenton Varda and Sunil Pai. Their insight was simple: LLMs are better at writing code to call APIs than at calling APIs directly. Sunil Pai has been a driving force in this space, pushing the idea that agents should generate and execute TypeScript against typed SDKs rather than making individual tool calls. Cloudflare's Dynamic Workers pioneered running that untrusted code at the edge in V8 isolates, and their execution model (send code to an isolated runtime, bridge specific capabilities in, get a result back) is exactly what we adopted. Code Mode supports Cloudflare Workers as a first-class isolate driver.

What we've done is turn this pattern into a composable, model-agnostic tool that plugs into any TanStack AI chat pipeline. Code Mode works with any model that can write TypeScript and reason well. Use it with OpenAI, Anthropic, Gemini, Groq, xAI, Ollama, or any other provider through our adapter system. You don't need to build the sandbox infrastructure, the type stub generation, or the system prompt engineering. Define your tools, pick a driver, pick your model, and the LLM gets a TypeScript sandbox with typed access to your entire tool surface.

## How It Works

Code Mode is modeled as a single tool called `execute_typescript`. When the LLM decides it needs to compose multiple operations, it writes TypeScript code and passes it to this tool. The code runs inside an isolate: a sandboxed environment with no access to the host file system, network, or process.

Your existing tools become `external_*` functions inside the sandbox. If you have a `fetchWeather` tool and a `searchProducts` tool, the sandbox sees `external_fetchWeather()` and `external_searchProducts()`, fully typed, fully async, fully isolated.

### The N+1 example

Consider an e-commerce app where the user asks: _"What are the top 5 best-selling products, and what's the average rating for each?"_

Without Code Mode, the LLM calls `getTopProducts`, waits for the result, then calls `getProductRatings` five separate times (one per product), waits for each result, then tries to compute averages in its head. That's seven tool calls, seven round-trips, and the averages are likely wrong because the model is doing mental math on floating-point numbers.

With Code Mode, the LLM writes this:

```typescript
const top = await external_getTopProducts({ limit: 5 })

const ratings = await Promise.all(
  top.products.map((p) => external_getProductRatings({ productId: p.id })),
)

return top.products.map((product, i) => {
  const scores = ratings[i].ratings.map((r) => r.score)
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
  return {
    name: product.name,
    sales: product.totalSales,
    averageRating: Math.round(avg * 100) / 100,
  }
})
```

One tool call. Five API fetches in parallel. Math computed in JavaScript, not in the model. The averages are correct to the penny. The context window savings compound fast: every round-trip you eliminate is hundreds of tokens you don't spend.

### Why math matters

LLMs predict tokens. They don't execute arithmetic. When the model says "the average is 4.37," it's pattern-matching, not computing. Code Mode moves all calculation into a real runtime. Sums, averages, percentages, currency conversions, date math: all of it runs as actual JavaScript. The model decides _what_ to compute. The sandbox computes it correctly.

## Setting It Up

### Install

```bash
pnpm add @tanstack/ai @tanstack/ai-code-mode zod
```

Pick an isolate driver:

```bash
# Node.js: fastest, V8 isolates via isolated-vm
pnpm add @tanstack/ai-isolate-node

# QuickJS WASM: no native deps, works in browsers and edge runtimes
pnpm add @tanstack/ai-isolate-quickjs

# Cloudflare Workers: run on the edge
pnpm add @tanstack/ai-isolate-cloudflare
```

### Define tools

Same `toolDefinition()` API you already use. Nothing changes here:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const fetchWeather = toolDefinition({
  name: 'fetchWeather',
  description: 'Get current weather for a city',
  inputSchema: z.object({ location: z.string() }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string(),
  }),
}).server(async ({ location }) => {
  const res = await fetch(`https://api.weather.example/v1?city=${location}`)
  return res.json()
})
```

### Create Code Mode and use it with `chat()`

```typescript
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { createCodeMode } from '@tanstack/ai-code-mode'
import { createNodeIsolateDriver } from '@tanstack/ai-isolate-node'

const { tool, systemPrompt } = createCodeMode({
  driver: createNodeIsolateDriver(),
  tools: [fetchWeather],
  timeout: 30_000,
})

const result = await chat({
  adapter: openaiText('gpt-5.4'),
  systemPrompts: ['You are a helpful assistant.', systemPrompt],
  tools: [tool],
  messages,
})
```

`createCodeMode` returns two things: the `execute_typescript` tool and a system prompt containing typed function stubs for every tool you passed in. The model sees exact input/output types, so it generates correct calls without guessing parameter shapes. TypeScript annotations are stripped automatically before execution.

## Three Sandbox Runtimes

Code Mode is runtime-agnostic. All three drivers implement the same `IsolateDriver` interface. Swap them without changing any other code.

| Driver                            | Best for                    | Native deps     | Browser |
| --------------------------------- | --------------------------- | --------------- | ------- |
| `@tanstack/ai-isolate-node`       | Server-side Node.js         | Yes (C++ addon) | No      |
| `@tanstack/ai-isolate-quickjs`    | Browsers, edge, portability | None (WASM)     | Yes     |
| `@tanstack/ai-isolate-cloudflare` | Edge on Cloudflare          | None            | N/A     |

The **Node driver** uses V8 isolates via `isolated-vm` for maximum performance. JIT compilation, no serialization overhead beyond tool call boundaries. The **QuickJS driver** compiles to WASM and runs anywhere JavaScript runs, including the browser. The **Cloudflare driver** sends code to a deployed Worker and bridges tool calls back to your server via HTTP round-trips.

Each execution creates a fresh sandbox context. Configurable timeouts and memory limits prevent runaway scripts. The sandbox is destroyed after every call.

## Skills: Persistent, Reusable Code Libraries

Code Mode is powerful on its own. But what if your LLM could get smarter over time?

Right now the model rewrites the same logic every time. If it figures out a good way to fetch and rank NPM packages, that knowledge disappears when the conversation ends.

**Skills** fix this. The `@tanstack/ai-code-mode-skills` package lets the LLM save working code as a named, typed, persistent skill. On future requests, relevant skills are loaded from storage and exposed as first-class tools. The LLM calls them directly without rewriting the logic.

### The lifecycle

1. The LLM writes code via `execute_typescript` to solve a problem
2. The code works. The LLM calls `register_skill` to save it with a name, description, and schemas
3. On the next conversation, the system loads skill metadata and uses a cheap/fast model to select relevant skills
4. Selected skills appear as direct tools the LLM can call, no sandbox needed
5. Execution stats are tracked. Skills earn trust through successful runs

### Two integration paths

**High-level**: `codeModeWithSkills()` handles everything. Skill selection via a cheap LLM call, tool registry assembly, system prompt generation.

```typescript
import { codeModeWithSkills } from '@tanstack/ai-code-mode-skills'
import { createFileSkillStorage } from '@tanstack/ai-code-mode-skills/storage'
import { createNodeIsolateDriver } from '@tanstack/ai-isolate-node'
import { openaiText } from '@tanstack/ai-openai'

const storage = createFileSkillStorage({ directory: './.skills' })

const { toolsRegistry, systemPrompt } = await codeModeWithSkills({
  config: {
    driver: createNodeIsolateDriver(),
    tools: [myTool1, myTool2],
    timeout: 60_000,
  },
  adapter: openaiText('gpt-5.4-mini'), // cheap model for skill selection
  skills: { storage, maxSkillsInContext: 5 },
  messages,
})

const stream = chat({
  adapter: openaiText('gpt-5.4'), // strong model for reasoning
  toolRegistry: toolsRegistry,
  messages,
  systemPrompts: ['You are a helpful assistant.', systemPrompt],
})
```

**Manual**: use `createCodeMode`, `skillsToTools`, and `createSkillManagementTools` individually when you want full control over which skills load and how they're assembled.

### Storage

Skills are just TypeScript text and metadata. Your application is free to store them wherever it wants. We ship file-based and in-memory storage implementations, but anything that satisfies the `SkillStorage` interface works: a database, S3, Redis, whatever fits your stack.

### Trust

Skills start untrusted and earn trust through successful executions. Four built-in strategies control promotion thresholds:

| Strategy       | Provisional at         | Trusted at              |
| -------------- | ---------------------- | ----------------------- |
| Default        | 10+ runs, ≥90% success | 100+ runs, ≥95% success |
| Relaxed        | 3+ runs, ≥80% success  | 10+ runs, ≥90% success  |
| Always trusted | Immediately            | Immediately             |
| Custom         | You decide             | You decide              |

Trust is metadata today. It doesn't gate execution. But the infrastructure is there for when you want to build approval workflows or restrict untrusted skills to sandboxed execution only.

## Showing It in the UI

Code Mode emits custom events through the AG-UI streaming protocol as code executes. Your client receives them via the `onCustomEvent` callback on `useChat`:

| Event                         | When                                 |
| ----------------------------- | ------------------------------------ |
| `code_mode:execution_started` | Sandbox begins executing             |
| `code_mode:console`           | Each `console.log/error/warn/info`   |
| `code_mode:external_call`     | Before an `external_*` function runs |
| `code_mode:external_result`   | After a successful `external_*` call |
| `code_mode:external_error`    | When an `external_*` call fails      |

Every event carries a `toolCallId` that ties it to the specific `execute_typescript` call, so you can render a live execution timeline alongside the right message. Console output streaming in, external function calls with arguments and durations, errors as they happen.

## Try It: The Code Mode Demo

It's hard to impart just how much of a game changer code mode really is. You have to try it for yourself. The TanStack AI monorepo includes a full working example at `examples/ts-code-mode-web`. It's a TanStack Start app with multiple demo scenarios:

- **NPM/GitHub Chat**: ask questions about packages, the LLM writes code that calls NPM and GitHub APIs in parallel
- **Database Demo**: natural language queries over an in-memory dataset, with skill registration
- **Structured Output**: Code Mode generating typed, validated output
- **Reporting**: an agent that builds live dashboards by writing code

To run it:

```bash
git clone https://github.com/TanStack/ai.git
cd ai
pnpm install
pnpm --filter ts-code-mode-web dev
```

Set your API keys in the example's `.env` file (OpenAI, Anthropic, or Gemini). The app lets you switch providers and isolate runtimes (Node vs. QuickJS) from the UI.

## What's Next

Code Mode is available now across three packages:

```bash
pnpm add @tanstack/ai-code-mode                # Core
pnpm add @tanstack/ai-code-mode-skills         # Persistent skills
pnpm add @tanstack/ai-isolate-node             # or quickjs, or cloudflare
```

We're working on:

- **DevTools integration**: visual timeline of sandbox execution, skill creation, and trust progression
- **More isolate drivers**: Deno, Docker, and AWS Lambda sandboxes

The full documentation is in the [Code Mode Guide](https://tanstack.com/ai/latest/docs/guides/code-mode) and the [Skills Guide](https://tanstack.com/ai/latest/docs/guides/code-mode-with-skills).

---

_TanStack AI is open-source, provider-agnostic, and framework-agnostic. [Get started here.](https://tanstack.com/ai)_
