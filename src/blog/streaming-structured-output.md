---
title: 'Stop Waiting on JSON: Stream Structured Output with One Schema'
published: 2026-05-14
excerpt: "Pass a Zod schema to useChat and get a typed `partial` and `final` for free. No more parsePartialJSON glue, no more onChunk wiring. TanStack AI now streams structured output end-to-end across OpenAI, OpenRouter, Grok, Groq, and Ollama."
library: ai
authors:
  - Alem Tuzlak
---

![Stop Waiting on JSON](/blog-assets/streaming-structured-output/header.png)

You ask an LLM for a `Person` object. You hit send. The spinner spins. Five seconds. Ten. Twenty. Somewhere on a server in Oregon, the model is happily generating tokens, and your user is staring at a loading state until the very last `}` of the JSON arrives.

That UX is bad and you already know it. The fix, in theory, is "just stream it." The fix, in practice, has been writing 15 lines of glue: an `onChunk` handler, a `useState`, a `parsePartialJSON` call, a manual cast to your `Person` type. Repeat in every project. Hope you got the types right.

This release kills the glue. `useChat({ outputSchema })` now gives you a typed `partial` and `final` straight from the hook. One schema. End to end.

## The old shape

Until now, mixing streaming with `outputSchema` in `@tanstack/ai` looked something like this on the client:

```tsx
const [partial, setPartial] = useState<Partial<Person>>({})
const [final, setFinal] = useState<Person | null>(null)
let raw = ''

useChat({
  connection: fetchServerSentEvents('/api/extract'),
  onChunk: (chunk) => {
    if (chunk.type === 'TEXT_MESSAGE_CONTENT') {
      raw += chunk.delta
      setPartial(parsePartialJSON(raw))
    } else if (chunk.name === 'structured-output.complete') {
      setFinal(chunk.value.object as Person)
    }
  },
})
```

This works, but every byte of it is something you didn't want to write:

- You're manually accumulating a string buffer.
- You're calling `parsePartialJSON` yourself and hoping it tolerates whatever half-JSON the model just emitted.
- You're casting `chunk.value.object` to `Person` with no real proof it actually matches your schema.
- You're doing this in every component that wants a typed live preview.

The schema lives on the server. The same schema would happily describe `partial` and `final` on the client. There was no reason for the client to be guessing.

## The new shape

Pass the schema. Get the types back.

```tsx
import { useChat } from '@tanstack/ai-react'
import { fetchServerSentEvents } from '@tanstack/ai-client/event-client'
import { PersonSchema } from './schemas'

const { partial, final, status } = useChat({
  connection: fetchServerSentEvents('/api/extract'),
  outputSchema: PersonSchema,
})
```

That's the whole thing.

- `partial` is `DeepPartial<Person>` and updates on every streamed delta. The framework parses the partial JSON for you and narrows the type to whatever fields have arrived so far.
- `final` is `Person | null`. It flips to a fully-typed `Person` the moment the model emits the structured-output completion event.
- No `parsePartialJSON` import. No `onChunk`. No `useState`. No casts.

The same hook returns the message stream you already use, so partial UI previews and chat transcripts live side-by-side without conflict.

## What changed under the hood

The headline is the hook, but the work that made it possible touches the whole stack.

**A real type for the structured-output stream.** `chat({ outputSchema, stream: true })` now returns a `StructuredOutputStream<T>` that's a proper discriminated union: every regular `StreamChunk` plus a single tagged `StructuredOutputCompleteEvent<T>` carrying a strongly-typed `value.object`. You no longer fight `any` when you destructure or `switch` on the event.

**Tagged variants for the other custom events too.** While we were in there, `ApprovalRequestedEvent` and `ToolInputAvailableEvent` became their own tagged shapes. Tool-calling flows narrow cleanly without a helper.

**Per-chunk debug logging in the structured path.** The streaming structured output path now calls `logger.provider` on every chunk, matching the behavior of plain `chatStream`. Provider-level debugging is no longer a black box just because you opted into a schema.

**Provider coverage.** OpenAI, OpenRouter, Grok, Groq, and Ollama (anything riding the `openai-base`) all go through the same streaming structured output pipeline. The summarize adapter got the same treatment, so structured summaries stream end-to-end too.

**Framework parity.** `useChat({ outputSchema })` works in `@tanstack/ai-react`, `@tanstack/ai-vue`, `@tanstack/ai-solid`, and `@tanstack/ai-svelte`. Same return shape, same types, same behavior.

## Why this is the right shape

There's a temptation, when designing this kind of API, to invent a separate hook: `useStructuredChat`, `useTypedChat`, something parallel. That would have been a mistake. A schema isn't a different mode of chatting, it's just extra information the hook can use.

By folding `outputSchema` into the existing `useChat`, the upgrade path from "I'm using a chat hook" to "I'm using a chat hook with typed streaming output" is *literally one prop*. Your tool wiring, your approval prompts, your transcript state, everything that was already on `useChat` still works exactly the same way. The new behavior only exists for the keys that depend on the schema.

The cost of "one more hook for a slightly different case" is paid in docs, in user confusion, and in the long tail of `useFooButSometimesBar` hooks people inevitably accumulate. We'd rather not.

## Try it

Install the latest:

```bash
pnpm add @tanstack/ai @tanstack/ai-react @tanstack/ai-openai zod
```

Define the schema once. Use it on both sides.

```ts
// schemas.ts
import { z } from 'zod'

export const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
})
```

On the server, hand the schema to `chat` and stream the response as Server-Sent Events:

```ts
// app/api/extract/route.ts
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai/adapters'
import { PersonSchema } from './schemas'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const stream = chat({
    adapter: openaiText('gpt-5.2'),
    messages,
    outputSchema: PersonSchema,
    stream: true,
  })

  return toServerSentEventsResponse(stream)
}
```

On the client, point `useChat` at that endpoint and pass the same schema:

```tsx
// app/extract/page.tsx
import { useChat } from '@tanstack/ai-react'
import { fetchServerSentEvents } from '@tanstack/ai-client/event-client'
import { PersonSchema } from './schemas'

const { partial, final } = useChat({
  connection: fetchServerSentEvents('/api/extract'),
  outputSchema: PersonSchema,
})

return (
  <form>
    <input value={partial.name ?? ''} readOnly />
    <input value={partial.age ?? ''} readOnly />
    <input value={partial.email ?? ''} readOnly />
    {final && <p>Done. Extracted a fully-validated Person.</p>}
  </form>
)
```

Read the full guide: [tanstack.com/ai/docs/chat/structured-outputs](https://tanstack.com/ai/docs/chat/structured-outputs).

Drop the glue. Pass the schema. Ship the feature.
