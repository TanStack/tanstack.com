---
title: 'TanStack AI Just Got Middleware — And It Changes Everything'
published: 2026-03-12
excerpt: Your chat endpoint starts simple, then you need logging, filtering, caching, rate limiting, and suddenly it's a 200-line monster. TanStack AI now ships a first-class middleware system.
library: ai
authors:
  - Alem Tuzlak
---

![TanStack AI Middleware](/blog-assets/tanstack-ai-middleware/header.webp)

If you've ever built a production AI application, you know the pain. Your `chat()` call starts simple — then you need logging, then content filtering, then tool caching, then rate limiting, then an audit trail... and suddenly your clean server endpoint is a 200-line monster with deeply nested try/catch blocks.

TanStack AI now ships a **first-class middleware system** for the `chat()` function. It's composable, type-safe, and comes with batteries included via the new `@tanstack/ai/middlewares` subpath export.

Let's dive in.

## The Shape of a Middleware

A middleware is just an object with optional hooks. No classes, no inheritance, no decorators — just a plain object that satisfies the `ChatMiddleware` interface:

```typescript
import type { ChatMiddleware } from '@tanstack/ai'

const logger: ChatMiddleware = {
  name: 'logger',
  onStart(ctx) {
    console.log(
      `[${ctx.requestId}] Chat started — model: ${ctx.model}, provider: ${ctx.provider}`,
    )
  },
  onFinish(ctx, info) {
    console.log(
      `[${ctx.requestId}] Done in ${info.duration}ms — ${info.usage?.totalTokens} tokens`,
    )
  },
}
```

Drop it into the `middleware` array and you're done:

```typescript
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'

const stream = chat({
  adapter: openaiText('gpt-5.4'),
  messages: [{ role: 'user', content: 'Explain middleware to me' }],
  middleware: [logger],
})
```

No wrapping, no monkey-patching, no provider-specific hacks.

## The Lifecycle: 12 Hooks, Zero Guesswork

The middleware system exposes hooks at every meaningful point in the `chat()` lifecycle:

```
chat() called
  → onConfig (phase: 'init')     // transform config before anything runs
  → onStart                       // one-time setup
  ┌─ ITERATION LOOP ──────────────────────────────────────┐
  │ → onConfig (phase: 'beforeModel')  // tweak config per iteration   │
  │ → onIteration                       // observe iteration boundary   │
  │ → onChunk (for every streamed chunk)                               │
  │ → onBeforeToolCall → [tool executes] → onAfterToolCall             │
  │ → onToolPhaseComplete               // all tools done this round   │
  │ → onUsage                           // token counts                │
  └────────────────────────────────────────────────────────┘
  → onFinish / onAbort / onError   // exactly ONE fires
```

Every hook receives a rich `ChatMiddlewareContext` with `requestId`, `iteration`, `chunkIndex`, current `messages`, and two powerful control functions: **`abort()`** to stop the run, and **`defer()`** to register non-blocking side effects that run after streaming completes.

## What Middleware Enables

Before we look at code, let's talk about what this actually unlocks.

### Transform Anything the Model Sees

`onConfig` fires at two critical moments — once at startup (`phase: 'init'`) and once before every model call (`phase: 'beforeModel'`). Return a partial config and it's shallow-merged in. You can change `messages`, `systemPrompts`, `tools`, `temperature`, `maxTokens`, `metadata`, or `modelOptions` — per request, per iteration, conditionally.

This means you can inject tenant-specific system prompts based on who's making the request. You can strip tools out after the first iteration so the model stops looping. You can bump temperature on retries. All without touching your adapter or your tool definitions.

When multiple middleware define `onConfig`, the config is **piped** through them in order — each one sees the merged result of the previous. So you can layer concerns: one middleware handles auth-based prompt injection, another handles tool filtering, a third adjusts model parameters. They compose naturally.

### Intercept Every Streamed Chunk

`onChunk` gives you access to every piece of data the adapter yields. You can observe it, transform it, expand it into multiple chunks, or drop it entirely by returning `null`.

This is where content filtering lives. Redact PII before it reaches the client. Strip out markdown formatting your UI doesn't support. Inject synthetic chunks to add custom metadata to the stream. If a previous middleware drops a chunk, downstream middleware never see it — the pipeline is clean.

### Control Tool Execution Without Touching Tools

`onBeforeToolCall` and `onAfterToolCall` wrap every tool invocation. Before a tool runs, you can:

- **Pass through** — return `void`, the tool runs normally
- **Transform arguments** — return `{ type: 'transformArgs', args }` to rewrite what the tool receives
- **Skip execution** — return `{ type: 'skip', result }` to short-circuit with a synthetic result (this is how caching works)
- **Abort the entire run** — return `{ type: 'abort', reason }` to stop everything

This is **first-win** composition: the first middleware that returns a non-void decision wins, and the rest are skipped for that call. After execution, `onAfterToolCall` fires on all middleware with timing data, success/failure status, and the result or error.

`onToolPhaseComplete` fires after _all_ tool calls in an iteration are done, giving you aggregate data — what completed, what needs user approval, what needs client-side execution. This is where you'd implement batch-level validation or summary logging.

### Track Token Spend in Real Time

`onUsage` fires once per model iteration with `promptTokens`, `completionTokens`, and `totalTokens`. Combined with `ctx.iteration`, you can build cumulative budgets, per-model cost tracking, or real-time spend dashboards without any external instrumentation.

### Abort from Anywhere

`ctx.abort(reason)` is available in every hook. Call it and the run stops gracefully — `onAbort` fires as the terminal hook with the reason and duration. This is how you implement timeouts, budget limits, content policy violations, or any "stop everything" signal.

### Fire-and-Forget Side Effects

`ctx.defer(promise)` registers a non-blocking promise that executes _after_ the terminal hook. It never blocks streaming. This is the right pattern for analytics, audit logs, webhook notifications, or database writes that shouldn't add latency to the user's response.

### Thread Request-Scoped Data

The `context` option on `chat()` is an opaque value that flows into `ctx.context` on every hook. Pass in your auth token, tenant ID, feature flags, or any request-scoped data — middleware reads it without coupling to your HTTP framework.

## Composition: Order Matters (But Predictably)

Middleware compose cleanly in array order with well-defined semantics:

```typescript
middleware: [authMiddleware, guardMiddleware, cacheMiddleware, loggerMiddleware]
```

| Hook               | Composition Model | What "order" means                                          |
| ------------------ | ----------------- | ----------------------------------------------------------- |
| `onConfig`         | **Piped**         | Each middleware transforms config, next one sees the result |
| `onChunk`          | **Piped**         | Chunks flow through each middleware in sequence             |
| `onBeforeToolCall` | **First-win**     | First non-void decision wins, rest are skipped              |
| Everything else    | **Sequential**    | All run in order, no short-circuiting                       |

This means you can stack a content guard _before_ a logger and the logger only sees the redacted output. Or put a rate limiter _before_ a cache and the cache never stores rate-limited calls. The ordering is explicit, the rules are simple, and there are no surprises.

## Built-in Middleware: `@tanstack/ai/middlewares`

The new subpath export ships two production-ready middlewares. You don't need to write these yourself — they're tree-shakeable, so unused ones don't end up in your bundle.

### `toolCacheMiddleware` — Never Re-Execute the Same Tool Call

If your agent calls `getWeather({ city: "Berlin" })` three times in a conversation, do you really want to hit the API three times?

```typescript
import { chat } from '@tanstack/ai'
import { toolCacheMiddleware } from '@tanstack/ai/middlewares'

const stream = chat({
  adapter,
  messages,
  tools: [weatherTool, stockTool],
  middleware: [
    toolCacheMiddleware({
      ttl: 60_000, // expire after 60s
      maxSize: 50, // LRU eviction at 50 entries
      toolNames: ['getWeather'], // only cache weather lookups
    }),
  ],
})
```

Under the hood, it uses `onBeforeToolCall` to check the cache and returns `{ type: 'skip', result }` on a hit — the tool never executes. On a miss, `onAfterToolCall` stores the result. Failed calls are never cached.

**Custom cache keys** let you ignore irrelevant arguments:

```typescript
toolCacheMiddleware({
  keyFn: (toolName, args) => {
    const { page, ...rest } = args as Record<string, unknown>
    return JSON.stringify([toolName, rest]) // ignore pagination
  },
})
```

**Pluggable storage** means you can swap the in-memory LRU map for Redis, a database, or anything with `getItem`/`setItem`/`deleteItem`:

```typescript
import { createClient } from 'redis'
import {
  toolCacheMiddleware,
  type ToolCacheStorage,
} from '@tanstack/ai/middlewares'

const redis = createClient()

const redisStorage: ToolCacheStorage = {
  getItem: async (key) => {
    const raw = await redis.get(`tool-cache:${key}`)
    return raw ? JSON.parse(raw) : undefined
  },
  setItem: async (key, value) => {
    await redis.set(`tool-cache:${key}`, JSON.stringify(value))
  },
  deleteItem: async (key) => {
    await redis.del(`tool-cache:${key}`)
  },
}

const stream = chat({
  adapter,
  messages,
  tools: [weatherTool],
  middleware: [toolCacheMiddleware({ storage: redisStorage, ttl: 60_000 })],
})
```

### `contentGuardMiddleware` — Real-Time Stream Redaction

Your model just streamed back a user's SSN. Your model just leaked an internal API key. Your model included PII in a customer-facing response.

```typescript
import { contentGuardMiddleware } from '@tanstack/ai/middlewares'

const guard = contentGuardMiddleware({
  rules: [
    // Regex rules: pattern + replacement
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
    { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[API KEY REDACTED]' },

    // Function rules: full control
    {
      fn: (text) =>
        text.replace(
          /\b[A-Z0-9._%+-]+@company\.internal\b/gi,
          '[EMAIL REDACTED]',
        ),
    },
  ],
  strategy: 'buffered', // catches patterns that span chunk boundaries
  bufferSize: 60, // hold back 60 chars to catch cross-boundary matches
  onFiltered: (info) => {
    console.warn(`Content filtered in message ${info.messageId}`)
  },
})
```

Two strategies are available:

- **`delta`** — applies rules to each chunk as it arrives. Zero added latency, but patterns split across chunk boundaries might slip through.
- **`buffered`** (default) — accumulates content and applies rules to settled portions, holding back a configurable look-behind buffer. Catches cross-boundary patterns at the cost of a tiny delay.

Set `blockOnMatch: true` to drop entire chunks when any rule matches instead of replacing:

```typescript
contentGuardMiddleware({
  rules: [{ pattern: /CONFIDENTIAL/gi, replacement: '' }],
  blockOnMatch: true, // if the word appears, the chunk is gone
})
```

## Ideas: What You Could Build

The middleware system is deliberately low-level and composable. Here are patterns that fall right out of the hook design.

### Per-Iteration Tool Swapping

Expose different tool sets at different stages of the agent loop — let the model search first, then unlock write tools:

```typescript
const progressiveTools: ChatMiddleware = {
  name: 'progressive-tools',
  onConfig(ctx, config) {
    if (ctx.phase !== 'beforeModel') return

    if (ctx.iteration === 0) {
      return { tools: config.tools.filter((t) => t.name === 'search') }
    }
    // After search results come back, unlock everything
  },
}
```

### Token Budget Enforcement

Track cumulative usage and abort when you've spent enough:

```typescript
function tokenBudget(maxTokens: number): ChatMiddleware {
  let total = 0
  return {
    name: 'token-budget',
    onUsage(ctx, usage) {
      total += usage.totalTokens
      if (total > maxTokens) {
        ctx.abort(`Token budget exhausted: ${total}/${maxTokens}`)
      }
    },
  }
}
```

### Deferred Analytics (Non-Blocking)

Fire-and-forget side effects that never slow down streaming:

```typescript
const analytics: ChatMiddleware = {
  name: 'analytics',
  onFinish(ctx, info) {
    ctx.defer(
      fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify({
          requestId: ctx.requestId,
          model: ctx.model,
          provider: ctx.provider,
          duration: info.duration,
          tokens: info.usage?.totalTokens,
          toolCount: ctx.toolNames?.length ?? 0,
        }),
      }),
    )
  },
}
```

### Dangerous Tool Guard

Intercept tool calls and block the ones you don't trust:

```typescript
const dangerousToolGuard: ChatMiddleware = {
  name: 'dangerous-tool-guard',
  onBeforeToolCall(ctx, hookCtx) {
    const blocked = ['deleteUser', 'dropTable', 'sendEmail']
    if (blocked.includes(hookCtx.toolName)) {
      return {
        type: 'abort',
        reason: `Blocked dangerous tool: ${hookCtx.toolName}`,
      }
    }
  },
}
```

### Tenant-Aware Prompt Injection

Thread request-scoped data through middleware via `context`:

```typescript
// Server endpoint
const stream = chat({
  adapter,
  messages,
  middleware: [tenantMiddleware],
  context: { tenantId: req.auth.tenantId, userId: req.auth.userId },
})

// Middleware reads it
const tenantMiddleware: ChatMiddleware = {
  name: 'tenant',
  onConfig(ctx, config) {
    const { tenantId } = ctx.context as { tenantId: string }
    return {
      systemPrompts: [
        ...config.systemPrompts,
        `You are an assistant for tenant ${tenantId}. Follow their policies.`,
      ],
    }
  },
}
```

### Stacking It All Together

The real power is composition. Here's what a production setup might look like:

```typescript
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import {
  toolCacheMiddleware,
  contentGuardMiddleware,
} from '@tanstack/ai/middlewares'

const stream = chat({
  adapter: openaiText('gpt-5.4'),
  messages: req.body.messages,
  tools: [searchTool, weatherTool, calendarTool],
  context: { tenantId: req.auth.tenantId },
  middleware: [
    // 1. Inject tenant system prompt
    tenantMiddleware,
    // 2. Guard dangerous tools before anything else
    dangerousToolGuard,
    // 3. Redact PII from the stream
    contentGuardMiddleware({
      rules: [
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
      ],
    }),
    // 4. Cache expensive tool calls
    toolCacheMiddleware({ ttl: 120_000 }),
    // 5. Enforce token budget
    tokenBudget(50_000),
    // 6. Log everything (sees redacted output, not raw)
    analytics,
  ],
})
```

Six concerns. Six middleware. Zero coupling between them. The order is explicit and the composition rules are predictable.

## DevTools Integration

Middleware events are wired into TanStack DevTools out of the box. Every hook execution, config transformation, and chunk transformation emits structured events via `@tanstack/ai-event-client`. The new **Iteration Timeline** and **Iteration Card** UI components let you visually trace what happened at each step of the agent loop — which middleware fired, how long each hook took, and what was transformed.

This isn't just logging. It's a full timeline view of your middleware pipeline, per iteration, in real time.

## Getting Started

```bash
pnpm add @tanstack/ai
```

All middleware types are exported from the main package:

```typescript
import type {
  ChatMiddleware,
  ChatMiddlewareContext,
  ChatMiddlewareConfig,
  BeforeToolCallDecision,
  AfterToolCallInfo,
  FinishInfo,
  AbortInfo,
  ErrorInfo,
  UsageInfo,
} from '@tanstack/ai'
```

Built-in middleware lives in the tree-shakeable subpath:

```typescript
import {
  toolCacheMiddleware,
  contentGuardMiddleware,
} from '@tanstack/ai/middlewares'
```

The full middleware documentation is available in the [TanStack AI Middleware Guide](https://tanstack.com/ai/latest/docs/guides/middleware).
