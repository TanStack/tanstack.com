---
title: 'Your AI Tool Calls Should Fail at Compile Time, Not in Production'
published: 2026-04-22
excerpt: Provider tools like web search and code execution are supported on some models and silently ignored on others. TanStack AI now gates them per model at the type level, so incompatible pairings fail at compile time instead of in production.
authors:
  - Alem Tuzlak
---

![Type-safe provider tools in TanStack AI](/blog-assets/type-safe-provider-tools-tanstack-ai/header.png)

You wire up `webSearchTool` on your Anthropic adapter. You ship. A week later, a user complains the model's answers feel weirdly out of date. You dig in. Turns out the model you rolled out to half your users doesn't actually support that tool. No error. No exception. The model just quietly pretends the tool doesn't exist and makes up an answer.

This is the worst kind of bug: type-clean, lint-clean, test-clean, production-loud.

As of the latest TanStack AI release, this class of bug is impossible to ship. Provider tools are now gated at the type level, per model, at compile time. If the pairing is invalid, TypeScript tells you on the line where you pass the tool.

## Why provider tools fail silently

A "provider tool" is a native capability the provider hosts for you. Anthropic web search. OpenAI code interpreter. Gemini Google search. Computer use. Bash. Text editor. These are not functions you wrote; they're first-class features the provider's infrastructure runs on the model's behalf.

Here's the catch: support is per model, not per provider.

| Model | Provider tools supported |
|---|---|
| `claude-3-haiku` | `web_search` only |
| `claude-3-5-haiku` | web tools only (`web_search`, `web_fetch`) |
| `claude-opus-4-6` | full superset (web, code execution, computer use, bash, editor, memory) |
| `gpt-3.5-turbo` | none |
| `gpt-5` family | full superset |
| `gemini-3-pro` | full superset |
| `gemini-lite` | narrower subset |

If you pass `computerUseTool` to `claude-3-haiku`, the provider either rejects the request, or more commonly, the model ignores the tool and generates a confident-sounding response anyway. No stack trace. No warning. Nothing for your tests to catch, because the response shape is valid, just wrong.

The SDK cannot help you here unless the type system knows which model accepts which tool. That is the gap this release fills.

## The broken path, before

Before this release, every tool factory returned a plain `Tool`. The compiler treated them as interchangeable:

```typescript
import { chat } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'
import { computerUseTool } from '@tanstack/ai-anthropic/tools'

const stream = chat({
  adapter: anthropicText('claude-3-haiku'),
  tools: [
    computerUseTool({ /* ... */ }),
  ],
})
```

Ships clean. Passes CI. Fails in the wild.

## The fix: phantom-branded ProviderTool

Every provider tool factory now returns a `ProviderTool<TProvider, TKind>` brand. The adapter carries a `toolCapabilities` list in its type channel, derived from each model's `supports.tools` array. TypeScript gates the `tools: [...]` array so only brands in that list are assignable.

Same code, now:

```typescript
const stream = chat({
  adapter: anthropicText('claude-3-haiku'),
  tools: [
    computerUseTool({ /* ... */ }),
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Type 'AnthropicComputerUseTool' is not assignable to type
    // 'Tool & { "~toolKind"?: never } | ProviderTool<string, "web_search">'.
  ],
})
```

The error lands on the array element, exactly where you would fix it. Swap the model to `claude-opus-4-6` and the same line compiles. Swap `computerUseTool` for `webSearchTool` and it compiles on `claude-3-haiku` too, because haiku-3 supports web search.

You don't have to remember the compatibility matrix. The compiler remembers it for you.

## Your own tools stay frictionless

Gating only makes sense for provider-hosted tools, because only those have per-model support differences. Tools you write yourself are your code; they run wherever your code runs. The `toolDefinition(...)` helper in `@tanstack/ai` returns a plain unbranded `Tool`, and the `customTool(...)` factories from the OpenAI and Anthropic adapters do the same. All of them are universally assignable:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { webSearchTool } from '@tanstack/ai-anthropic/tools'

const myTool = toolDefinition({ /* ... */ })

chat({
  adapter: anthropicText('claude-3-haiku'),
  tools: [
    myTool,                       // fine, always
    webSearchTool({ /* ... */ }), // fine, haiku-3 supports it
  ],
})
```

No workarounds. No casts. User-defined tools behave the way they always have.

## How it works under the hood

Three ingredients make this safe:

1. **Per-model capability declarations.** Each model constant declares a `supports.tools` array: `['web_search']`, or the full superset, or `[]`. This is the ground truth.

2. **A capability map lifted into types.** A mapped type (for example `AnthropicChatModelToolCapabilitiesByName`) converts the runtime `supports.tools` into a type map indexed by model name. The text adapter threads this through a `toolCapabilities` generic on its `~types` channel.

3. **A gated discriminated union on `tools`.** `TextActivityOptions['tools']` is declared as:

   ```typescript
   type ToolsFor<TAdapter> = ReadonlyArray<
     | (Tool & { '~toolKind'?: never })
     | ProviderTool<string, TAdapter['~types']['toolCapabilities'][number]>
   >
   ```

   Unbranded tools match the first arm. Provider tools only match the second arm if their `TKind` is in the current adapter's capability list.

"Phantom-branded" means the `TKind` tag exists only in the type system. At runtime, a `ProviderTool` is a plain object; the brand is erased by the TypeScript compiler. Zero bundle cost. Zero runtime cost. The guarantee is entirely in the types.

## Why per-provider, not per-gateway

There is a popular pattern in the AI SDK space: abstract tools behind a gateway layer so one interface "works everywhere." That has real ergonomic value. It also has a ceiling: the lowest common denominator of what every provider supports, with every provider's specific options flattened away.

TanStack AI bets the other direction. You want _Anthropic's_ web search with its actual options (`max_uses`, domain filters, citation formatting), not a generic web-search shape that has to marshal onto four different providers. You want OpenAI's code interpreter with its full container model, not a lowest-common sandbox.

The tradeoff of the native approach is obvious: more surface to misuse. That is exactly what per-model type gating fixes. You get the full provider-native tool surface, _and_ you get a compiler that refuses to let you misapply it.

## Tree-shakeable `/tools` subpath

Every adapter now exports its provider tools from a dedicated `/tools` subpath:

```typescript
import { webSearchTool } from '@tanstack/ai-anthropic/tools'
import { codeInterpreterTool } from '@tanstack/ai-openai/tools'
import { googleSearchTool } from '@tanstack/ai-gemini/tools'
import { webSearchTool as openRouterWebSearch } from '@tanstack/ai-openrouter/tools'
```

If you don't import a tool, it doesn't end up in your bundle. Adapter roots stay lean; tool factories ship on demand. The same pattern holds across `@tanstack/ai-anthropic`, `@tanstack/ai-openai`, `@tanstack/ai-gemini`, `@tanstack/ai-openrouter`, `@tanstack/ai-grok`, and `@tanstack/ai-groq`.

## Try it

The AI tool-calling surface has always been underspecified at the type level. Models advertise capabilities they partially implement. SDKs promise uniformity they cannot fully deliver. The result is a class of bugs that slip past tests and only show up when a real user asks a real question.

TanStack AI closes that gap at the exact point it matters: the line where you hand tools to a model. If the pairing is invalid, you know before you commit.

Upgrade your `@tanstack/ai-*` adapters, import provider tools from the `/tools` subpath, and read the [Provider Tools guide](https://tanstack.com/ai/latest/docs/tools/provider-tools) for the per-model matrix.
