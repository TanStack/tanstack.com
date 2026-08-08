---
title: 'BytePlus on TanStack AI: Seed, Seedance, Seedream, and Seed Speech'
published: 2026-08-05
excerpt: '@tanstack/ai-byteplus is out — Seed chat, Seedance, Seedream, and Seed Speech in one TanStack AI adapter for BytePlus ModelArk and Seed Speech.'
library: ai
authors:
  - Tom Beckenham
---

BytePlus is ByteDance’s international model platform: Seed for chat, Seedance for video, Seedream for images, and Seed Speech for TTS and transcription. The models are strong. The international surface is real. What has been missing is a **single typed TypeScript path across the whole stack** — chat, image, video, and speech — that matches the rest of your AI app instead of a one-off HTTP integration.

**[`@tanstack/ai-byteplus`](https://tanstack.com/ai/latest/docs/adapters/byteplus) is that path for TanStack AI.** One package for ModelArk and Seed Speech: typed factories, streaming, structured output where the models support it, and the same `chat` / `generateImage` / `generateVideo` / `generateSpeech` / `generateTranscription` activities you use with every other provider.

No new app architecture. No partnership pitch. Just another adapter you plug in.

## Why this adapter exists

BytePlus does not ship an official TypeScript SDK for international developers the way OpenAI or Anthropic do. You get REST docs, region-specific base URLs, and product splits. Wiring the full surface yourself means owning all of this:

- **Seed chat** — reasoning by default, encrypted reasoning signatures, structured-output support that does not match published tables
- **Seedance video** — async job API, not a single request/response
- **Seedream image** — watermarks, group generation, short-lived result URLs
- **Seed Speech** — TTS and transcription on a **different host with a different API key**
- The usual integration tax: dual products, region-isolated Ark keys, model ids that retire under you

Without a multimodal adapter you hand-roll each product against REST and re-derive the quirks every time a dated model id ships.

TanStack AI’s job is provider-agnostic tooling across modalities. Shipping `@tanstack/ai-byteplus` means Seed, Seedance, Seedream, and Seed Speech share the same typed API as OpenAI, Anthropic, Gemini, fal, and the rest of the matrix — without hand-rolling HTTP, SSE framing, or job polling.

## Install

```bash
npm install @tanstack/ai-byteplus
# or
pnpm add @tanstack/ai-byteplus
```

## Two products, two keys

BytePlus does not share credentials across its full stack. Treat them as two products:

| Adapters                                         | Product        | Env var                                          | Auth                    |
| ------------------------------------------------ | -------------- | ------------------------------------------------ | ----------------------- |
| `byteplusText`, `byteplusVideo`, `byteplusImage` | ModelArk (Ark) | `ARK_API_KEY` (falls back to `BYTEPLUS_API_KEY`) | `Authorization: Bearer` |
| `byteplusSpeech`, `byteplusTranscription`        | Seed Speech    | `BYTEPLUS_VOICE_API_KEY`                         | `X-Api-Key`             |

```bash
# ModelArk: chat, Seedance video, Seedream image
ARK_API_KEY=...

# Seed Speech: TTS and transcription — separate product key
BYTEPLUS_VOICE_API_KEY=...
```

Passing an Ark key to the speech adapters fails with `45000010 Invalid X-Api-Key`. That is a platform boundary, not an adapter bug.

Ark keys are also **region-isolated**. The default base URL is the Asia-Pacific south-east endpoint. A key issued for one region will not authenticate against another — point the adapter with `baseURL` when you need EU or another region:

```ts
import { createBytePlusText } from '@tanstack/ai-byteplus'

const adapter = createBytePlusText('dola-seed-2-1-turbo-260628', arkApiKey, {
  baseURL: 'https://ark.eu-west.bytepluses.com/api/v3',
})
```

Per BytePlus docs, the EU endpoint serves chat and image; Seedance video remains Asia-Pacific only.

## Chat (Seed)

The adapter carries the model. There is no separate `model` option. Server streaming over SSE looks like every other TanStack AI chat endpoint:

```ts
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { byteplusText } from '@tanstack/ai-byteplus'

export async function POST(request: Request) {
  const { messages } = await request.json()

  const stream = chat({
    adapter: byteplusText('dola-seed-2-1-turbo-260628'),
    messages,
  })

  return toServerSentEventsResponse(stream)
}
```

On the client, keep using `useChat` with `fetchServerSentEvents` — nothing BytePlus-specific in the UI layer.

Ark’s chat endpoint is OpenAI-compatible for sampling, so `temperature`, `top_p`, and `max_tokens` live in `modelOptions` under their snake_case names. Ark-only additions include `thinking`, `reasoning_effort`, `repetition_penalty`, and `service_tier`.

### Reasoning is on by default

Most Seed models reason by default. Reasoning arrives as its own stream of `reasoning_content` deltas and surfaces as reasoning content in TanStack AI, so `useChat` can render it separately from the answer. Turn it off per request:

```ts
const stream = chat({
  adapter: byteplusText('dola-seed-2-1-turbo-260628'),
  messages,
  modelOptions: { thinking: { type: 'disabled' } },
})
```

Several “thinking summary” models also emit an opaque `encrypted_content` blob alongside the reasoning trace. BytePlus expects that signature back on the next assistant turn. **The adapter round-trips it for you** over the same seam Anthropic thinking signatures use: captured off the stream, attached as the reasoning step’s `signature`, and echoed on the next request.

If you persist conversation history yourself, keep the thinking parts’ `signature`. Dropping it costs a reasoning-cache hit; it is not fatal — Ark still accepts the turn.

### Structured output: fail loud, not soft

Ten of the eighteen chat models accept `response_format: { type: 'json_schema' }`. Use `outputSchema` as usual:

```ts
import { chat } from '@tanstack/ai'
import { byteplusText } from '@tanstack/ai-byteplus'
import { z } from 'zod'

const RecipeSchema = z.object({
  name: z.string(),
  minutes: z.number(),
  ingredients: z.array(z.string()),
})

const recipe = await chat({
  adapter: byteplusText('dola-seed-2-1-turbo-260628'),
  messages: [{ role: 'user', content: 'Give me a recipe for carbonara' }],
  outputSchema: RecipeSchema,
})
```

On models that do not support schemas, the adapter **throws** (or emits `RUN_ERROR` when streaming) instead of degrading to free-form prose. There is no JSON-mode fallback — Ark rejects `json_object` on those models too.

Two live-API findings worth internalizing:

- Published capability tables are wrong in both directions. The “obvious” default `seed-2-0-lite-260428` rejects JSON schema; reach for `seed-2-0-lite-260228` or `dola-seed-2-1-turbo-260628` when you need typed output.
- Some models accept a schema and then ignore it. Those ids are deliberately excluded from the supported list so you fail at the adapter boundary, not at parse time.

`BYTEPLUS_STRUCTURED_OUTPUT_CHAT_MODELS` is exported if you want to gate a model picker on the real list.

## Image (Seedream)

```ts
import { generateImage } from '@tanstack/ai'
import { byteplusImage } from '@tanstack/ai-byteplus'

const result = await generateImage({
  adapter: byteplusImage('dola-seedream-5-0-pro-260628'),
  prompt: 'a guitar being played in a store',
  size: '2K',
  modelOptions: { watermark: false },
})

console.log(result.images[0]?.url)
```

`size` is either a token (`1K`, `2K`, `4K`) or explicit pixels — never a mix. Pass image parts in the prompt array to edit or condition on references.

Two behaviors that surprise people:

- **`watermark` defaults to `true`.** BytePlus stamps “AI generated” unless you pass `watermark: false`. The adapter does not override the provider default.
- **`numberOfImages` is an upper bound, not a count.** Seedream has no `n` parameter; multi-image requests use group-image mode where the model decides how many images the prompt warrants. A request for four can return two.

Generated image URLs expire after 24 hours. Prefer `response_format: 'b64_json'` in `modelOptions` when you need durable bytes.

## Video (Seedance)

Video generation is experimental in TanStack AI. Seedance is an **async task API**: open a job, poll (or stream) to completion, then download before the URL expires (24 hours after completion).

```ts
import { generateVideo, getVideoJobStatus } from '@tanstack/ai'
import { byteplusVideo } from '@tanstack/ai-byteplus'

const adapter = byteplusVideo('dreamina-seedance-2-0-260128')

const { jobId } = await generateVideo({
  adapter,
  prompt: 'a guitar being played in a store',
  size: '16:9_720p',
  duration: 5,
})

let status = await getVideoJobStatus({ adapter, jobId })
while (status.status === 'pending' || status.status === 'processing') {
  await new Promise((resolve) => setTimeout(resolve, 5000))
  status = await getVideoJobStatus({ adapter, jobId })
}

console.log(status.status === 'completed' ? status.url : status.error)
```

Or hand polling to the core with `stream: true` and drive it from `useGenerateVideo` on the client — same pattern as other video adapters.

Per-model options matter. Ark **rejects** inapplicable fields with a `400` rather than ignoring them. Resolution tiers, draft mode, `camera_fixed`, `priority`, and reference-media roles all depend on which Seedance id you picked. The adapter encodes probe-verified capability tables so unsupported combinations fail locally with a clear error before the request goes out.

Seedance 2.5 (`dreamina-seedance-2-5-260628`) is reachable but **activation-gated per account**. Until you enable it in the Ark Console, Ark returns `404 ModelNotOpen`. It is deliberately untyped in the model tables until capabilities can be verified; pass the id as a string and the adapter relaxes local guards so Ark validates the request.

Seedance is also available through [`@tanstack/ai-fal`](https://tanstack.com/ai/latest/docs/adapters/fal). Use fal if you already live there; use `@tanstack/ai-byteplus` when you want direct BytePlus billing, model ids, and first-class Seedance fields.

## Speech (Seed Speech)

TTS and transcription use `BYTEPLUS_VOICE_API_KEY`, not the Ark key.

```ts
import { generateSpeech } from '@tanstack/ai'
import { byteplusSpeech } from '@tanstack/ai-byteplus'

const result = await generateSpeech({
  adapter: byteplusSpeech('seed-audio-1.0'),
  text: 'welcome to the guitar store',
  voice: 'en_female_stokie_uranus_bigtts',
  format: 'mp3',
})
```

Seed Speech has no top-level speaker field. The adapter maps `voice` into `references: [{ speaker }]`. If you pass `modelOptions.references` for voice cloning, that array **replaces** the stock voice entry — include a `speaker` yourself if you still want one.

Transcription is synchronous: audio in, transcript out.

```ts
import { generateTranscription } from '@tanstack/ai'
import { byteplusTranscription } from '@tanstack/ai-byteplus'

const result = await generateTranscription({
  adapter: byteplusTranscription('seed-asr'),
  audio: audioFile,
  modelOptions: { enable_punc: true, enable_speaker_info: true },
})
```

## Probe-verified model ids

BytePlus retires model ids aggressively, and published lists include ids that no longer resolve. This package ships **dated ids that answered a live request**. The authoritative lists are exported for pickers:

- `BYTEPLUS_CHAT_MODELS`
- `BYTEPLUS_VIDEO_MODELS`
- `BYTEPLUS_IMAGE_MODELS`
- `BYTEPLUS_TTS_MODELS`
- `BYTEPLUS_TRANSCRIPTION_MODELS`

Unknown string ids still work where the platform allows them — useful for brand-new releases — with relaxed local narrowing so Ark remains the source of truth.

## What you get for free

Because this is a TanStack AI adapter, the rest of the stack is already there:

- Framework hooks: `useChat`, `useGenerateImage`, `useGenerateVideo`, `useGenerateSpeech`, and friends across React, Solid, Vue, and Svelte
- SSE transport via `toServerSentEventsResponse` / `fetchServerSentEvents`
- Shared tool-calling flow (`toolDefinition`) — Ark uses the standard OpenAI tool shape; BytePlus does not ship provider-specific tool factories
- Middleware, orchestration, and the same testing posture we use across the provider matrix

Swap the adapter. Keep the app.

## Get started

```bash
pnpm add @tanstack/ai-byteplus
```

Set `ARK_API_KEY` (and `BYTEPLUS_VOICE_API_KEY` if you need speech), pick a Seed model, and stream a chat.

Full reference — dual keys, region endpoints, model tables, Seedance options, and speech gotchas — lives in the docs:

**[BytePlus adapter docs →](https://tanstack.com/ai/latest/docs/adapters/byteplus)**

If you want Seed, Seedance, Seedream, and Seed Speech under one TanStack AI adapter, this is it.
