---
title: 'Surviving the refresh'
published: 2026-08-04
excerpt: 'A user reloads mid-answer and three things break: the transcript, the stream, and the agent doing the work. TanStack AI now ships chat persistence, resumable streams, generation persistence and durable sandboxed agent runs, plus server-side memory, rebuilt interrupts and multi-instance locks.'
library: ai
authors:
  - Alem Tuzlak
---

A user asks your agent a hard question. Tokens start streaming. They hit refresh.

In most AI apps, three things break at once. The transcript is gone, because it only ever lived in React state. The stream is gone, because the connection that carried it is gone. And if a sandboxed agent was doing the work, that agent is dead too, killed by the disconnect of the viewer who was watching it.

This release fixes all three. TanStack AI now ships server-side chat persistence, resumable streams, generation persistence for media, and durable sandboxed agent runs. It also adds server-side memory, a rebuilt interrupt lifecycle, multi-instance locks, and a BytePlus adapter. That is 70 changesets across 31 packages, and four new ones: `@tanstack/ai-persistence`, `@tanstack/ai-durable-stream`, `@tanstack/ai-memory`, and `@tanstack/ai-byteplus`.

## Three failures that look like one bug

"It broke when I refreshed" is a bug report you get constantly, and it hides three separate problems that need three separate fixes.

**The transcript layer.** Where the conversation lives. If it lives in the browser only, a new device shows nothing.

**The delivery layer.** How bytes reach the client. A dropped socket loses the reply that was in flight, and calling the model again costs money and produces a different answer.

**The work layer.** Who is actually running. For a sandboxed coding agent, the work outlives the request that started it, so tying its lifetime to one HTTP connection is simply wrong.

Most SDKs give you one of these and call it durability. Fixing one and not the others gets you a partial answer: the transcript comes back, but the half-finished reply is still lost.

## How it works

One route, two handlers, one client option. The `POST` produces the run and records it. The `GET` answers whichever question the returning client is asking: replay a run that is still streaming, or hand back the stored transcript.

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

Two mechanisms sit behind those branches.

The **delivery log** is ordered and per run. Every chunk is recorded before it is delivered, and each event carries an opaque offset. On reconnect the client sends the last offset it saw and the server replays from there, so the provider is never called twice for one answer.

The **run record** is one row that describes one execution. Chat persistence and the sandbox run driver read and write the same record, so they can no longer disagree about whether a given run is alive. A run is joinable from the moment it is accepted, not from its first chunk, which closes the window where refreshing during a slow boot orphaned a live run forever.

## Layer 1: the conversation survives

`withPersistence` writes the transcript, the run status, and any pending tool approvals into a store you own. On the client it is one option, and the only real decision is who owns the history:

```tsx
const { messages, sendMessage } = useChat({
  threadId: 'support-chat',
  connection: fetchServerSentEvents('/api/chat'),
  persistence: true, // server owns it: multi-user, multi-device
  // persistence: localStoragePersistence(), // browser owns it: no server store
})
```

**Bring your own storage.** There is no required database. You implement a small store contract, and the package ships typers so you get autocomplete and contract checking with no annotations:

```ts
import { defineMessageStore } from '@tanstack/ai-persistence'

export const messages = defineMessageStore({
  // Returns [] for a thread that was never saved. Never null.
  loadThread: (threadId) => db.transcripts.read(threadId),
  // A full replace: `messages` is the complete authoritative history.
  saveThread: (threadId, messages) => db.transcripts.write(threadId, messages),
})
```

A basic adapter is about 40 lines, and `memoryPersistence()` covers local dev. If you are writing one, the shared conformance testkit now covers the generation stores too, so you can prove your implementation is correct instead of hoping.

## Layer 2: the stream reconnects

A resumable stream lets a client re-attach to an in-flight response after a refresh, a dropped connection, or a suspended tab, without calling the provider again. You plug a durability adapter into the response:

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

Swap the adapter for production and nothing else changes:

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

It works for SSE and NDJSON. Any other store (Redis, Postgres, a queue) is a four-method `StreamDurability` interface away, so no specific infrastructure is baked in.

## Layer 3: media generation comes back too

Chat is not the only thing that streams. Image, video, speech, and transcription runs are long, expensive, and exactly the kind of thing a user reloads during.

The server half mirrors chat, with `withGenerationPersistence` and a `reconstructGeneration` route:

```ts
import { generateImage, toServerSentEventsResponse } from '@tanstack/ai'
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

The client half is one boolean, and the restore lands in the same fields a fresh run uses:

```tsx
import { fetchServerSentEvents, useGenerateImage } from '@tanstack/ai-react'

const image = useGenerateImage({
  threadId,
  connection: fetchServerSentEvents('/api/generate/image'),
  persistence: true, // reload repaints the last run, bytes included
})
```

The failure modes got attention too, because a wrong "success" is worse than an error. A restored generation whose result cannot be rebuilt now reports an error instead of repainting as a blank success, and a stream that ends without a terminal chunk settles to `error` instead of leaving the client on `generating` forever.

## Layer 4: the agent keeps working

This is the deepest change. A sandboxed coding agent used to write its output into a pipe held by the host process. Kill the host, kill the agent.

Now the agent writes newline-delimited JSON to a journal file inside the sandbox. The host can return, die, or be replaced without taking the agent down. When a client comes back, a later request takes the run over: it reads a bounded slice of the stored log, lines its own output up against the prefix the previous host already delivered, and keeps streaming from there.

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

A disconnect records `detachedSince` and leaves the agent running. Because "still running" costs money, the release ships the sweep as well:

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

Sandbox instances can also resume across processes and replicas, so this works on a real multi-replica deploy, not just one box.

## Also in this release

**Server-side memory.** `@tanstack/ai-memory` adds a `recall`/`save` adapter contract and middleware. `inMemory()` for dev, `redis()` for production, or `hindsight()`, `mem0()`, and `honcho()` for hosted services. Memory state is now visible in DevTools through a memory inspector.

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

**Interrupts, rebuilt.** Tool approvals, generic interrupts, and client tools now follow the AG-UI interrupt lifecycle: typed bound resolvers, atomic batches, and structured errors. No database is required, because the continuation carries the message history.

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

**Multi-instance locks.** `@tanstack/ai/locks` answers a different question from persistence: not "what is durable" but "who may run this critical section right now". Two replicas can no longer both create a sandbox for the same thread.

```ts
import { InMemoryLockStore, withLocks } from '@tanstack/ai/locks'

chat({
  adapter: openaiText('gpt-5.5'),
  messages,
  // Single process. Multi-instance: pass a distributed LockStore instead.
  middleware: [withLocks(new InMemoryLockStore()), withSandbox(sandbox)],
})
```

**A new provider.** `@tanstack/ai-byteplus` covers BytePlus ModelArk: Seed chat models, Seedance video, Seedream image, and Seed Speech for text-to-speech and transcription. Note that ModelArk and Seed Speech are two products with two keys.

```ts
import { generateVideo, getVideoJobStatus } from '@tanstack/ai'
import { byteplusVideo } from '@tanstack/ai-byteplus'

const adapter = byteplusVideo('dreamina-seedance-2-0-260128') // ARK_API_KEY

// Seedance is an asynchronous task API: you get a job, then poll it.
const { jobId } = await generateVideo({
  adapter,
  prompt: 'a guitar being played in a store',
  size: '16:9_720p',
  duration: 5,
})

let status = await getVideoJobStatus({ adapter, jobId })
```

**One less dependency.** zod is out of `@tanstack/ai`'s dependency graph entirely.

## Try it

Durability is not one feature. It is a transcript layer, a delivery layer, and a work layer that agree on what a thread and a run are. That agreement is the release.

```bash
pnpm add @tanstack/ai-persistence @tanstack/ai-durable-stream @tanstack/ai-memory
```

Then read the [Persistence Overview](/ai/docs/persistence/overview), pick a store, and reload the page mid-answer on purpose. Nothing should be lost.
