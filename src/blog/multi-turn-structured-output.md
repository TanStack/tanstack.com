---
title: 'Structured Output That Remembers Across Turns'
published: 2026-05-19
excerpt: "useChat({ outputSchema }) used to keep one slot for partial/final, so multi-turn structured chats lost prior turns the moment a new one streamed in. Every assistant turn now carries its own typed StructuredOutputPart on its UIMessage. History is preserved by default, and the schema generic threads all the way down to messages[i].parts[j].data."
library: ai
authors:
  - Alem Tuzlak
---

![Structured Output That Remembers Across Turns](/blog-assets/multi-turn-structured-output/header.png)

You ask the LLM for a recipe. It plates up *Spaghetti Pomodoro* — title, cuisine, servings, ingredients, steps, all typed against your schema. Beautiful. You ask it to make the recipe vegan. A new recipe streams in.

Then the first one vanishes.

That used to be the deal with `useChat({ outputSchema })`: one hook-level `partial` / `final` slot. The instant a new turn started streaming, the previous turn's recipe was clobbered. Multi-turn anything (recipe refinement, ticket triage, iterative form filling) needed manual history plumbing — you'd intercept every chunk, snapshot `final` into your own state, juggle a `recipes[]` array yourself, and keep it in sync with `messages[]` to avoid drift. The schema's type safety also stopped at `partial` / `final`; once a structured payload landed in your local array, it was `unknown` again unless you cast.

We just shipped a different shape. Every assistant turn now carries its own typed `structured-output` part on its `UIMessage`. History is preserved by default. The schema generic threads all the way down to `messages[i].parts.find(p => p.type === 'structured-output').data` — no casts, no manual tracking. Same `useChat` hook, same `outputSchema` option, less code in your component. If you missed the prior post on streaming a single typed object end-to-end, [start here](https://tanstack.com/blog/streaming-structured-output) — that piece is the antecedent to this one.

This post walks through what changed, why it matters for any multi-turn UI, and how to build the recipe-builder pattern end-to-end in roughly 80 lines (split across a server route and a client component).

## The old shape

The previous `useChat({ outputSchema })` exposed two values that tracked the *current* run:

- `partial` — `DeepPartial<T>`, the progressively-parsed object as JSON streamed in
- `final` — `T | null`, the validated object once `structured-output.complete` fired

On a single-turn extractor (paste a paragraph → get a typed `Person`), this was perfect. Field-by-field reveal as the JSON streamed, validated payload on terminal event, one render to consume both.

On a multi-turn chat it fell apart. `partial` and `final` were a *single slot*, scoped to whichever run was most recent. As soon as you called `sendMessage()` again, the previous turn's `final` was gone. The runtime had no place to keep it — the typed structured payload didn't live on the message itself, only in this transient hook state.

The workaround we'd see in user code:

```tsx
const [recipes, setRecipes] = useState<Array<Recipe>>([])

const { sendMessage, final } = useChat({
  outputSchema: RecipeSchema,
  connection: fetchServerSentEvents('/api/recipes'),
  onFinish: () => {
    if (final) setRecipes((prev) => [...prev, final])
  },
})
```

Three problems with that:

1. **The data lives in two places now.** `messages[]` has the assistant turns; `recipes[]` has the typed objects. Keeping them in sync (across reloads, retries, edits, server snapshots, replays) is your problem.
2. **The model can't see the history.** Your `recipes[]` array is local to the component, the wire layer never sees it. When the user types "now make the vegan one cheaper," the LLM has no idea what "the vegan one" refers to; it only sees the raw text of each prior turn, with the structured response stripped to whatever it landed on the original `TextPart` as. Multi-turn refinement collapses.
3. **You lose the schema's type safety.** `recipes` is typed, but the moment you try to round-trip a prior recipe back into the conversation, you're stringifying a typed object into the wire payload by hand. The library can't help you because it doesn't know `recipes` exists.

The right place for this state is *on the message it came from*. That's what we shipped.

## The new shape: typed parts on every assistant message

Every `UIMessage` has a `parts: MessagePart[]` array. Before, the variants were `text`, `image`, `audio`, `video`, `document`, `tool-call`, `tool-result`, `thinking`. We added one:

```ts
type StructuredOutputPart<TData = unknown> = {
  type: 'structured-output'
  status: 'streaming' | 'complete' | 'error'
  /** Progressive parse — populated while streaming and after complete. */
  partial?: DeepPartial<TData>
  /** Validated final object — set when status === 'complete'. */
  data?: TData
  /** Accumulating JSON buffer — source of truth for the wire round-trip. */
  raw: string
  reasoning?: string
  errorMessage?: string
}
```

The runtime routes `TEXT_MESSAGE_CONTENT` deltas (the streaming JSON bytes) into this part instead of building a `TextPart`. On the terminal `structured-output.complete` event, `status` flips to `'complete'` and `data` is populated with the validated object. Every assistant turn produces a *new* assistant message, which carries its *own* `structured-output` part. The previous turn's part is untouched.

The hook-level `partial` and `final` still exist, they're derived from the *latest* assistant message's part now, instead of being a sticky slot. That means they read `{}` and `null` between `sendMessage()` and the first chunk (because no new assistant message exists yet), and they snap to the freshest turn's payload as it streams. The migration is zero, the same code that read `partial` / `final` for a single-turn extractor reads identical values in the new shape.

What changed is everything *else*. Walking `messages[]` now exposes the full history of typed objects:

```tsx
type RecipePart = StructuredOutputPart<Recipe>

messages.map((m) => {
  if (m.role === 'assistant') {
    const part = m.parts.find(
      (p): p is RecipePart => p.type === 'structured-output',
    )
    // part.data is Recipe (the schema-inferred type) — no cast.
    // part.partial is DeepPartial<Recipe>.
    if (part) return <RecipeCard part={part} />
  }
  return null
})
```

The schema generic flows through `useChat<TTools, TSchema>` → `UIMessage<TTools, TData>` → `MessagePart<TTools, TData>` → `StructuredOutputPart<TData>`, so `part.data` resolves to `Recipe` with no cast. The `RecipePart` alias is for readability; you can inline `Extract<typeof p, { type: 'structured-output' }>` instead if you'd rather not name it. The same flow runs in Vue (`computed`), Solid (`createMemo`), and Svelte (`$derived.by`) — the parity work shipped in the same release.

## Building a recipe refinement loop

Here's the full recipe-builder pattern. Server endpoint first:

```ts
// app/api/recipes/route.ts
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { z } from 'zod'

export const RecipeSchema = z.object({
  title: z.string(),
  cuisine: z.string(),
  servings: z.number(),
  estimatedCostUsd: z.number(),
  ingredients: z.array(
    z.object({ item: z.string(), amount: z.string() }),
  ),
  steps: z.array(z.string()),
  tips: z.array(z.string()),
})

export type Recipe = z.infer<typeof RecipeSchema>

const SYSTEM = `You are a chef. Reply with a single recipe matching the JSON schema. When the user asks for modifications, produce a new recipe in the same shape that reflects the change.`

export async function POST(request: Request) {
  const { messages } = await request.json()
  const stream = chat({
    adapter: openaiText('gpt-5.2'),
    messages,
    systemPrompts: [SYSTEM],
    outputSchema: RecipeSchema,
    stream: true,
  })
  return toServerSentEventsResponse(stream)
}
```

That's the whole server side. The only structured-output-specific lines are `outputSchema: RecipeSchema` and `stream: true`. The runtime takes care of converting the schema to JSON Schema, hitting the provider's native structured-output API, validating the response, and emitting `structured-output.start` + `structured-output.complete` events to the client.

Client:

```tsx
import { useState } from 'react'
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import type { StructuredOutputPart } from '@tanstack/ai-client'
import { RecipeSchema, type Recipe } from './api/recipes'

type RecipePart = StructuredOutputPart<Recipe>

export function RecipeBuilder() {
  const [input, setInput] = useState('')

  const { messages, sendMessage, isLoading } = useChat({
    outputSchema: RecipeSchema,
    connection: fetchServerSentEvents('/api/recipes'),
  })

  return (
    <div>
      {messages.map((m) => {
        if (m.role === 'user') {
          const text = m.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.content)
            .join('')
          return <UserPrompt key={m.id} text={text} />
        }
        if (m.role === 'assistant') {
          const part = m.parts.find(
            (p): p is RecipePart => p.type === 'structured-output',
          )
          if (!part) return null
          return <RecipeCard key={m.id} part={part} />
        }
        return null
      })}

      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button
        onClick={() => {
          sendMessage(input)
          setInput('')
        }}
        disabled={isLoading || !input.trim()}
      >
        {isLoading ? 'Cooking…' : 'Cook'}
      </button>
    </div>
  )
}

function RecipeCard({ part }: { part: RecipePart }) {
  // `data` is Recipe (typed by the schema). `partial` is DeepPartial<Recipe>.
  // Both are typed — no cast, no `unknown`.
  const recipe = part.data ?? part.partial ?? {}
  return (
    <article>
      <h3>{recipe.title ?? 'Plating up…'}</h3>
      {recipe.cuisine && <p>{recipe.cuisine}</p>}
      {recipe.ingredients?.map((ing, i) => (
        <li key={i}>
          {ing?.amount} {ing?.item}
        </li>
      ))}
    </article>
  )
}
```

That's the entire client side. There's no separate `recipes[]` state, no `onFinish` callback, no manual history sync. Each `sendMessage()` triggers a new run, which produces a new assistant message, which carries its own typed structured-output part. The render loop walks `messages` and the new card just lands.

Try it:

> "Pasta dinner for two, under $15." → recipe lands.
>
> "Now make it vegan." → second recipe lands. The first is still on screen.
>
> "Add a salad and make it gluten-free." → third recipe lands. Both previous turns are still there.

## How the round-trip stays coherent

Multi-turn structured chats only work if the model sees its own prior responses on each follow-up turn. Otherwise turn N+1 has no idea what "make it vegan" refers to.

The wire layer handles this. When `useChat` sends turn N+1, it serializes the conversation back through `uiMessageToModelMessages`. For each assistant message with a completed `structured-output` part, the converter emits:

```ts
{ role: 'assistant', content: part.raw }
```

`part.raw` is the original JSON the model produced, preserved byte-for-byte from the streaming bytes that built the part in the first place. The model sees its own prior recipe verbatim and can reason about modifications. There's a defensive fallback (`JSON.stringify(part.data)`) for terminal-only completes that arrived without streamed bytes, plus a "drop the turn if we can't serialize it" guard for unserializable `data` like `BigInt`s or circular refs. Streaming and errored parts are dropped from the round-trip; you don't want to feed an incomplete JSON fragment back to the LLM.

You don't see any of this. You called `sendMessage('now make it vegan')` and the model knew what it was modifying.

## The schema generic threads through every framework

The same release shipped parity across the framework hook packages: `@tanstack/ai-react`, `@tanstack/ai-vue`, `@tanstack/ai-solid`, and `@tanstack/ai-svelte` (which uses `createChat` instead of `useChat`). Each one threads the `TSchema` generic the same way:

- `useChat<TTools, TSchema>` (or `createChat<TTools, TSchema>` for Svelte) substitutes `TData = InferSchemaType<TSchema>` when a schema is supplied.
- `messages` becomes `Array<UIMessage<TTools, TData>>`.
- `MessagePart<TTools, TData>` substitutes `StructuredOutputPart<TData>` into the discriminated union.

Net effect: in any of the four frameworks, with `outputSchema: RecipeSchema`, `messages[i].parts.find(p => p.type === 'structured-output').data` resolves to `Recipe | undefined`. Default `TData = unknown` keeps every existing consumer that doesn't pass a schema source-compatible.

`@tanstack/ai-preact` doesn't support `outputSchema` yet; that's tracked separately.

## When to use this

The multi-turn pattern lights up any UI where:

- Users iterate on a structured object across turns (recipe builder, design spec refinement, ticket triage, A/B copy variants).
- You want to render the history of typed objects, not just the latest.
- You want the model to remember its own structured responses on follow-ups without you serializing them yourself.

For a single round-trip (one prompt, one typed object), use [`chat({ outputSchema })`](https://tanstack.com/ai/docs/structured-outputs/one-shot), the non-streaming activity is simpler. For a streaming UI that progressively fills in one object (the classic field-by-field form), use [`useChat({ outputSchema })`](https://tanstack.com/ai/docs/structured-outputs/streaming) and read `partial` / `final`, the new shape preserves that surface unchanged. Use [multi-turn](https://tanstack.com/ai/docs/structured-outputs/multi-turn) when history is a feature, not a chore.

## Try it

The full recipe-builder UI ships in the [`ts-react-chat` example](https://github.com/TanStack/ai/tree/main/examples/ts-react-chat) at `/generations/structured-chat`: cuisine-aware hero banners, streaming preview, multi-turn history, the lot. The docs walk through the pattern at [structured-outputs/multi-turn](https://tanstack.com/ai/docs/structured-outputs/multi-turn).

If you already use `useChat({ outputSchema })`, you don't need to change anything to get the new types — `partial` and `final` keep working. You opt into multi-turn the moment you walk `messages` instead of just reading the hook-level sugar.

[**Read the multi-turn docs →**](https://tanstack.com/ai/docs/structured-outputs/multi-turn)
