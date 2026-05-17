---
title: 'TanStack AI now fully speaks AG-UI'
published: 2026-05-17
excerpt: 'Server-to-client AG-UI events already worked. TanStack AI now completes the round trip with client-to-server AG-UI compliance. Fully backward compatible.'
library: ai
authors:
  - Alem Tuzlak
---

![TanStack AI now fully speaks AG-UI](/blog-assets/ag-ui-compliance/header.png)

Half the protocol was already there.

For a while now, TanStack AI servers have emitted [AG-UI](https://ag-ui.com) events on the wire going out. The streaming side of the conversation (`RUN_STARTED`, tool-call events, run finish, errors) was already a compliant AG-UI event stream. The piece that was still proprietary was the _other_ direction: the request body going from client to server. The TanStack client POSTed `{ messages, data }`, not AG-UI's `RunAgentInput`.

That last half is what this release fixes. **TanStack AI is now fully AG-UI compliant in both directions.** Server-to-client events were AG-UI before. Client-to-server requests are AG-UI now. The round trip is done.

The same `@tanstack/ai-client` can hit any AG-UI server. Any AG-UI client can hit a TanStack server. And nothing about your existing code breaks.

## Why this matters

AG-UI is an open protocol for agent-to-frontend communication. It defines a single wire format, `RunAgentInput`, that carries the conversation, the tools, the thread and run IDs, and arbitrary forwarded properties. Servers that speak AG-UI can be addressed by any compliant client. Clients that emit AG-UI can talk to any compliant server.

With server-to-client AG-UI already in place, a TanStack server could _stream_ to a compliant client. But the client-to-server side was a one-way mirror: only the TanStack client could _send_ requests the TanStack server understood. The asymmetry meant true cross-vendor interop was still gated on rewriting your request layer.

Closing that gap is what this release does. The whole ecosystem (CopilotKit, CrewAI, LangGraph adapters, and now TanStack AI) gets to share the same plumbing in both directions.

## What changed on the wire

Before this release, `@tanstack/ai-client` POSTed:

```json
{
  "messages": [...],
  "data": { ... }
}
```

After:

```json
{
  "threadId": "thread-7f2a",
  "runId": "run-a91",
  "state": {},
  "messages": [...],
  "tools": [...],
  "context": [],
  "forwardedProps": { ... },
  "data": { ... }
}
```

The new envelope is the full AG-UI `RunAgentInput`. The old `data` field is still emitted as a mirror of `forwardedProps` so legacy servers reading `body.data.X` keep working unchanged. `threadId` persists per session, `runId` is fresh per send, and `tools` carries the client's `clientTools` declarations so the server can dispatch tool calls without a static registry.

Server-to-client events haven't changed shape, because they were already AG-UI compliant. They just now carry the matching `threadId` and `runId` you sent in.

## What changed in the API

Three new things to know about, all opt-in.

### `chat()` accepts `threadId`, `runId`, `parentRunId`

These were always part of the AG-UI event semantics on the way out. They're now first-class options on `chat()` and flow through every provider adapter into `RUN_STARTED` events for observability and run correlation.

```ts
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai/adapters'

const stream = chat({
  adapter: openaiText('gpt-4o'),
  threadId: 'thread-7f2a',
  runId: 'run-a91',
  messages: [...],
})
```

If you don't pass them, the runtime auto-generates a stable `threadId` per request and a fresh `runId` per call. Existing code that didn't know about them keeps working.

### `chatParamsFromRequest` for the server

A one-import helper that reads `req.json()`, validates the body against the AG-UI `RunAgentInputSchema`, and gives you a clean params object. On invalid input it throws a `400 Response` that frameworks like TanStack Start, SolidStart, Remix, and React Router 7 return to the client automatically.

```ts
import {
  chat,
  chatParamsFromRequest,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai/adapters'

export async function POST(req: Request) {
  const params = await chatParamsFromRequest(req)
  const stream = chat({
    adapter: openaiText('gpt-4o'),
    messages: params.messages,
    threadId: params.threadId,
    tools: serverTools,
  })
  return toServerSentEventsResponse(stream)
}
```

That's the whole server. No body shape to remember, no manual validation, and a typed `params.forwardedProps` if you want client-driven options like provider, model, or temperature.

### `forwardedProps` replaces `body` on the client

`useChat({ body: {...} })` still works, but `body` is now `@deprecated`. The canonical name is `forwardedProps`, which is what the new wire format calls the field. A jscodeshift codemod ships in the repo to flip every site:

```bash
npx jscodeshift \
  --parser=tsx \
  -t https://raw.githubusercontent.com/TanStack/ai/main/codemods/ag-ui-compliance/transform.ts \
  "src/**/*.{ts,tsx}"
```

It's import-source gated, so files that don't import from `@tanstack/ai*` are left alone.

## Nothing breaks

This is the part most "wire format change" releases get wrong. The upgrade ships three compatibility bridges so old code keeps running:

| Surface                | Legacy (still works)                     | Canonical                 |
| ---------------------- | ---------------------------------------- | ------------------------- |
| Client option          | `body: { ... }`                          | `forwardedProps: { ... }` |
| Server wire field      | `body.data.X` (mirror of forwardedProps) | `body.forwardedProps.X`   |
| Server `chat()` option | `conversationId`                         | `threadId`                |

A TanStack server reading `body.data.provider` keeps reading `body.data.provider` because the client emits both `data` and `forwardedProps` with the same content. A `chat({ conversationId })` call keeps working because `conversationId` is now a deprecated alias of `threadId`. Mix old and new freely. The bridges will be removed in the next major release, so migrate at your convenience.

## Bidirectional interop in practice

With both halves of the protocol compliant, the boundaries between AI SDKs get a lot blurrier.

**A pure AG-UI client (no TanStack code) hitting a TanStack server** works end-to-end. Tool messages pass through as `ModelMessage` entries with `role: 'tool'`. AG-UI `reasoning` and `activity` messages with no TanStack equivalent are dropped at the boundary. `developer` messages collapse to `system` role. The outbound event stream was already AG-UI, so the foreign client renders it natively.

**A TanStack client hitting a foreign AG-UI server** works for the common cases. Single-turn user messages mirror to AG-UI's `content` field. Server-emitted events stream and render. Multi-turn history with tool results from prior turns survives because the client sends AG-UI fan-out duplicates alongside the TanStack anchor messages.

The practical upshot: if you've been waiting to try a different inference provider, a different framework's agent runtime, or a different orchestrator, the wire is no longer the thing standing in your way. Both directions speak the same language.

## What's not in this release

A few things were intentionally left out:

- **Reasoning replay to LLM providers.** TanStack still drops `ThinkingPart` at the `UIMessage` → `ModelMessage` boundary. Providers like Anthropic that require thinking blocks to be replayed for extended thinking continuation are a separate track.
- **AG-UI `state` and `context` fields.** Surfaced on the params object but not yet wired into `chat()`. They're available for your endpoint to inspect or forward.
- **PHP and Python server packages.** No `chatParamsFromRequest` parity yet. Those examples temporarily lag on the old shape until the matching helpers ship.

## Try it

Upgrade `@tanstack/ai` and `@tanstack/ai-client` to the latest. If you're using one of the framework wrappers (`@tanstack/ai-react`, `-vue`, `-svelte`, `-solid`, `-preact`), bump those too so the client wire stays in lockstep.

- [Migration guide](https://tanstack.com/ai/migration/ag-ui-compliance) walks through the three deprecation bridges and the codemod
- [Star the repo](https://github.com/TanStack/ai) if this saved you an adapter

The AI stack is supposed to be the part you compose, not the part that locks you in. AG-UI is how that starts being true across vendors. With this release, TanStack AI is the first SDK to ship full bidirectional client-to-server _and_ server-to-client compliance against the AG-UI 0.0.52 spec. The next agent runtime you adopt should not be the one that finally forces you to rewrite your wire layer.
