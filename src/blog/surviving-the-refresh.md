---
title: 'Surviving the refresh'
published: 2026-08-04
excerpt: 'Reload mid-answer and the transcript, the stream, and the agent doing the work all vanish. TanStack AI now keeps them around: chat persistence, resumable streams, generation persistence, durable sandbox runs, server-side memory, rebuilt interrupts, and multi-instance locks.'
library: ai
authors:
  - Alem Tuzlak
---

You know the moment. The model is halfway through a good answer. Someone hits refresh — fat finger, flaky wifi, tab got discarded, doesn't matter — and the whole thing is just gone.

In most AI apps that single reload takes out three different things at once. The transcript only lived in React state, so it evaporates. The reply was still mid-flight on a streaming HTTP connection, so that dies with the tab. And if a sandboxed coding agent was mid-refactor, killing the viewer often kills the agent too. One reload. Three failures.

This release makes the reload survivable. TanStack AI now has server-side chat persistence, streams you can rejoin, generation persistence for media, and sandboxed agent runs that keep working after the browser leaves. On top of that: server-side memory, a rebuilt interrupt lifecycle, and multi-instance locks. Roughly 70 changesets across 31 packages, plus three new ones: `@tanstack/ai-persistence`, `@tanstack/ai-durable-stream`, and `@tanstack/ai-memory`.

## One bug report, three failures

"It broke when I refreshed" is a report you get all the time, and it almost always means three separate things failed.

**The transcript.** Where does the conversation actually live? If the answer is "in this browser tab," open the same thread on another device and you get nothing.

**The delivery.** How do the bytes get to the client? Drop the streaming connection and the half-finished reply is gone. Call the model again and you pay twice for a different answer.

**The work.** Who is actually running? A sandboxed coding agent can outlive the request that started it. Tying its lifetime to one HTTP connection was never the right shape.

A lot of SDKs ship one of these and call the release "durability." Fix only the transcript and the history comes back, but the half-written answer is still gone.

## How it works

One client flag. On the server, either an HTTP route or a TanStack Start server function — same persistence middleware either way.

The HTTP shape is the easiest to show. `POST` starts a run and records it. `GET` figures out what the returning client wants — rejoin a run that is still streaming, or hand back the stored thread.

```tsx
// app/api/chat/route.ts
import {
  chat,
  chatParamsFromRequest,
  memoryStream,
  resumeServerSentEventsResponse,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { reconstructChat, withPersistence } from '@tanstack/ai-persistence'
import { persistence } from './persistence'

export async function POST(request: Request) {
  const params = await chatParamsFromRequest(request)
  const stream = chat({
    adapter: openaiText('gpt-5.5'),
    messages: params.messages,
    threadId: params.threadId, // the conversation
    runId: params.runId, // this one execution inside it
    middleware: [withPersistence(persistence)],
  })
  // Records every chunk to an ordered log before delivering it.
  return toServerSentEventsResponse(stream, {
    durability: { adapter: memoryStream(request) },
  })
}

export function GET(request: Request): Response | Promise<Response> {
  const durability = memoryStream(request)

  // The client sent a resume offset, so a run is mid-flight: replay its log.
  if (durability.resumeFrom() !== null) {
    return resumeServerSentEventsResponse({ adapter: durability })
  }

  // Otherwise hand back the stored thread, plus a cursor to any run still generating.
  return reconstructChat(persistence, request, {
    // WITHOUT this, anyone who guesses a thread id gets the whole transcript.
    authorize: async (threadId, req) => ownsThread(req, threadId),
  })
}

// app/chat.tsx
import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'

export function Chat() {
  const { messages, sendMessage } = useChat({
    threadId: 'support-chat',
    connection: fetchServerSentEvents('/api/chat'),
    persistence: true, // on mount: ask the server, then rejoin any live run
  })
  return <button onClick={() => sendMessage('hi')}>{messages.length}</button>
}
```

On TanStack Start you can skip the route and call the server with `fetcher` instead of `connection`. Hydrate and rejoin still work — you pass them as handlers next to the fetcher (`hydrate` / `joinRun` on chat, `hydrateGeneration` / `joinRun` on generation hooks) instead of hanging them on a `GET`. Same middleware on the server; the client just reaches it without `/api/chat`.

Two mechanisms sit under both shapes.

The **delivery log** is ordered and per run. Every chunk is written before it is sent, and each event carries an opaque offset. Reconnect with the last offset you saw and the server replays from there. The provider is not called a second time for the same answer.

The **run record** is one row that describes one execution. Chat persistence and the sandbox run driver read and write the same record, so they cannot disagree about whether a run is still alive. A run is joinable the moment it is accepted, not after its first chunk — which closes the window where refreshing during a slow boot orphaned a live run forever.

## Layer 1: the conversation survives

`withPersistence` writes the transcript, the run status, and any pending tool approvals into a store you own. On the client it is one option. The only real product decision is who owns history:

```tsx
const { messages, sendMessage } = useChat({
  threadId: 'support-chat',
  connection: fetchServerSentEvents('/api/chat'),
  persistence: true, // server owns it: multi-user, multi-device
  // persistence: localStoragePersistence(), // browser owns it: no server store
})
```

**Bring your own storage.** There is no first-party Drizzle or Prisma package, and no required database. The package ships the store contracts, middleware, an in-memory backend for local dev, and a conformance test kit. You implement the stores against whatever you already run:

```ts
import { defineMessageStore } from '@tanstack/ai-persistence'

export const messages = defineMessageStore({
  // Returns [] for a thread that was never saved. Never null.
  loadThread: (threadId) => db.transcripts.read(threadId),
  // A full replace: `messages` is the complete authoritative history.
  saveThread: (threadId, messages) => db.transcripts.write(threadId, messages),
})
```

A basic adapter is about 40 lines. `memoryPersistence()` covers local dev. For a real backend, the shared conformance test kit now covers the generation stores too, so you can prove the implementation instead of hoping.

We also ship agent skills for this. Point a coding agent at your repo and the Drizzle skill (or Prisma, D1, custom) finds your dialect, schema, and `db` handle, then writes a `chat-persistence.ts` that plugs into what you already have — no second database, no parallel migration path. Hand-writing the adapter is fine too; the skill is there when you would rather not. Full walkthrough later.

## Layer 2: the stream reconnects

A resumable stream lets the client re-attach to an in-flight response after a refresh, a dropped connection, or a tab the OS decided to suspend — without calling the provider again. Plug a durability adapter into the response:

```ts
export async function POST(request: Request) {
  const { messages, threadId, runId } = await chatParamsFromRequest(request)
  const stream = chat({
    adapter: openaiText('gpt-5.5'),
    messages,
    threadId,
    runId,
  })
  return toServerSentEventsResponse(stream, {
    durability: { adapter: memoryStream(request) },
  })
}
```

Swap the adapter for production and leave everything else alone:

```ts
import { durableStream } from '@tanstack/ai-durable-stream'

return toServerSentEventsResponse(stream, {
  durability: {
    adapter: durableStream(request, {
      server: process.env.DURABLE_STREAMS_URL!,
    }),
  },
})
```

SSE and NDJSON both work. Redis, Postgres, a queue — anything else is a four-method `StreamDurability` interface away. No specific infrastructure is baked into the core.

## Layer 3: media generation comes back too

Chat is not the only thing that streams. Image, video, speech, and transcription runs are long, expensive, and exactly what people reload during while they stare at a spinner.

The server side mirrors chat: `withGenerationPersistence` plus a `reconstructGeneration` route.

```ts
import {
  generateImage,
  generationParamsFromRequest,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { openaiImage } from '@tanstack/ai-openai'
import { withGenerationPersistence } from '@tanstack/ai-persistence'
import { persistence } from './persistence'

export async function POST(request: Request) {
  const { prompt, threadId } = await generationParamsFromRequest(request)
  const stream = generateImage({
    adapter: openaiImage('gpt-image-2'),
    prompt,
    threadId, // the same scope the GET route hydrates from
    stream: true,
    middleware: [
      withGenerationPersistence(persistence, {
        // Makes the restored media render from your own origin. Optional.
        artifactUrl: (ref) =>
          `/api/generate/image/artifact?id=${ref.artifactId}`,
      }),
    ],
  })
  return toServerSentEventsResponse(stream)
}
```

On the client it is one boolean, and the restore lands in the same fields a fresh run uses:

```tsx
import { fetchServerSentEvents, useGenerateImage } from '@tanstack/ai-react'

const image = useGenerateImage({
  threadId,
  connection: fetchServerSentEvents('/api/generate/image'),
  persistence: true, // reload repaints the last run, bytes included
})
```

We spent time on the failure modes, because a wrong "success" is worse than an error. A restored generation whose result cannot be rebuilt now reports an error instead of painting a blank success. A stream that ends without a terminal chunk settles to `error` instead of leaving the client stuck on `generating` forever.

## Layer 4: the agent keeps working

This is the deepest change. A sandboxed coding agent used to write its output into a pipe held by the host process. Kill the host, kill the agent. Refresh the page, same outcome.

Now the agent journals newline-delimited JSON inside the sandbox. The host can return, die, or be replaced without taking the agent down. When a client comes back, a later request takes the run over: it reads a bounded slice of the stored log, lines its own output up against the prefix the previous host already delivered, and keeps streaming from there.

```ts
const adapter = memoryStream(request) // ONE adapter for journal + delivery log

const stream = chat({
  adapter: claudeCodeText('claude-opus-4-8'),
  messages,
  threadId,
  runId, // required: journal path and log name derive from it
  middleware: [
    withPersistence(persistence),
    withLocks(locks),
    withSandbox(sandbox, {
      runs: persistence.stores.runs, // the same RunStore chat persistence uses
      durability: { adapter },
    }),
  ],
})

return toServerSentEventsResponse(stream, { durability: { adapter } })
```

A disconnect records `detachedSince` and leaves the agent running. "Still running" costs money, so the release ships the sweep as well:

```ts
import { reapDetachedRuns, sandboxReclaimer } from '@tanstack/ai-sandbox'

// Cron: finish or close out every run whose viewer never came back.
export function sweepDetachedRuns() {
  return reapDetachedRuns({
    runs,
    locks,
    durability: durabilityFor, // per-run log factory
    hasFinished, // out-of-band "did the agent reach its sentinel?" probe
    drive: driveRun, // produce the run's remaining events
    now: Date.now(),
    detachedRunTtlMs: 30 * 60 * 1000,
    maxRuns: 25, // each run costs a lock, a round-trip and a replay
    reclaim: sandboxReclaimer({ provider: sandbox.provider, instances }),
  })
}
```

Sandbox instances can also resume across processes and replicas. This is meant for a real multi-replica deploy, not just one box you forgot to restart.

## Also in this release

**Server-side memory.** `@tanstack/ai-memory` adds a `recall`/`save` adapter contract and middleware. `inMemory()` for dev, `redis()` for production, or `hindsight()`, `mem0()`, and `honcho()` for hosted services. Memory state shows up in DevTools through a memory inspector.

```ts
import { memoryMiddleware } from '@tanstack/ai-memory'
import { redis } from '@tanstack/ai-memory/redis'

chat({
  adapter: openaiText('gpt-5.5'),
  messages,
  middleware: [
    memoryMiddleware({
      adapter: redis({ redis: client }),
      scope, // derived server-side from the session, never from the client
    }),
  ],
})
```

**Interrupts, rebuilt.** Tool approvals, generic interrupts, and client tools now follow the AG-UI interrupt lifecycle: typed bound resolvers, atomic batches, and structured errors. No database required — the continuation carries the message history.

```tsx
const { interrupts } = useChat({
  threadId: 'account-42',
  connection: fetchServerSentEvents('/api/chat'),
  tools: [transferTool] as const,
})

{
  interrupts.map((interrupt) => (
    <div key={interrupt.id}>
      <button
        disabled={!interrupt.canResolve}
        onClick={() => interrupt.resolveInterrupt(true)}
      >
        Approve
      </button>
      <button
        disabled={!interrupt.canResolve}
        onClick={() => interrupt.resolveInterrupt(false)}
      >
        Reject
      </button>
    </div>
  ))
}
```

**Multi-instance locks.** `@tanstack/ai/locks` answers a different question from persistence: not "what is durable" but "who may run this critical section right now." Two replicas can no longer both create a sandbox for the same thread.

```ts
import { InMemoryLockStore, withLocks } from '@tanstack/ai/locks'

chat({
  adapter: openaiText('gpt-5.5'),
  messages,
  // Single process. Multi-instance: pass a distributed LockStore instead.
  middleware: [withLocks(new InMemoryLockStore()), withSandbox(sandbox)],
})
```

**One less dependency.** zod is out of `@tanstack/ai`'s dependency graph entirely.

## Try it

Durability is not one feature. It is a transcript layer, a delivery layer, and a work layer that finally agree on what a thread and a run are. That agreement is what this release is.

```bash
pnpm add @tanstack/ai-persistence @tanstack/ai-durable-stream @tanstack/ai-memory
```

Then read the [Persistence Overview](/ai/docs/persistence/overview), pick a store, and reload the page mid-answer on purpose. Nothing should be lost.
