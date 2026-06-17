---
title: 'TanStack AI Just Learned to Compose Music'
published: 2026-04-24
excerpt: TanStack AI adds a new generateAudio activity with streaming, plus fal and Gemini Lyria adapters for music, sound effects, text-to-speech, and transcription. One typed API, any provider.
library: ai
authors:
  - Alem Tuzlak
---

![TanStack AI Just Learned to Compose Music](/blog-assets/tanstack-ai-audio-generation/header.png)

The AI audio ecosystem is a mess. Gemini's Lyria wants a natural-language prompt and returns raw PCM you have to wrap in a RIFF header yourself. Fal hosts dozens of audio models where one wants `music_length_ms` in milliseconds, the next wants `seconds_total`, and most want plain `duration`. ElevenLabs has its own shape. Whisper has another. Every provider disagrees on whether you get a URL, a base64 blob, or a raw buffer.

If you are shipping an AI product that needs music, sound effects, speech, or transcription, you end up writing the same boring glue code five times.

**TanStack AI just removed that glue.** The latest release lands a full audio stack: a new `generateAudio` activity, streaming support, fal and Gemini Lyria adapters, and framework hooks for React, Solid, Vue, and Svelte. One typed API, any provider.

Here is what shipped and why you should care.

## One activity, any audio model

The new `generateAudio()` activity sits alongside `generateImage`, `generateSpeech`, `generateVideo`, and `generateTranscription` in `@tanstack/ai`. It takes a text prompt, dispatches to whatever adapter you hand it, and returns a `GeneratedAudio` object with exactly one of `url` or `b64Json`.

```typescript
import { generateAudio } from '@tanstack/ai'
import { geminiAudio } from '@tanstack/ai-gemini/adapters'

const adapter = geminiAudio('lyria-3-pro-preview')

const result = await generateAudio({
  adapter,
  prompt: 'A cinematic orchestral piece with a rising string motif',
})

// result.audio is { url: string } | { b64Json: string } — exactly one, enforced by the type
```

Swap `geminiAudio` for `falAudio` and the exact same call generates music through MiniMax, DiffRhythm, Stable Audio 2.5, or any of the other models in fal's catalog. The adapter translates per-model details (like fal's `music_length_ms` vs `seconds_total` vs `duration` naming) so your app code never sees them.

## Streaming, because audio generation takes seconds

Music and SFX generation is slow. Lyria 3 Pro takes several seconds. Stable Audio takes longer. If you are building a UI, blocking the request the whole time is a bad experience.

`generateAudio` now supports `stream: true`, returning an `AsyncIterable<StreamChunk>` you can pipe straight through `toServerSentEventsResponse()`:

```typescript
export async function POST(req: Request) {
  const { prompt } = await req.json()

  const stream = await generateAudio({
    adapter: falAudio('fal-ai/minimax-music/v2.6'),
    prompt,
    stream: true,
  })

  return toServerSentEventsResponse(stream)
}
```

The client receives progress events and the final audio over a single SSE connection, the same transport model already used by `generateImage` and `generateVideo`. No new infrastructure, no special-case code paths.

## Framework hooks that feel like the others

Every framework integration gets a new hook matching the existing media-hook shape:

- `@tanstack/ai-react`: `useGenerateAudio`
- `@tanstack/ai-solid`: `useGenerateAudio`
- `@tanstack/ai-vue`: `useGenerateAudio`
- `@tanstack/ai-svelte`: `createGenerateAudio`

The API is identical to `useGenerateImage` and friends:

```tsx
import { useGenerateAudio } from '@tanstack/ai-react'

function MusicGen() {
  const { generate, result, isLoading, error, stop, reset } = useGenerateAudio({
    connection,
  })

  return (
    <>
      <button onClick={() => generate({ prompt: 'Lo-fi hip-hop beat' })}>
        Generate
      </button>
      {isLoading && <button onClick={stop}>Stop</button>}
      {result?.audio.url && <audio src={result.audio.url} controls />}
    </>
  )
}
```

Both `connection` (SSE) and `fetcher` (plain HTTP) transports are supported, so this works with TanStack Start, Next.js, Remix, or any backend you already have.

## Providers that shipped in this release

**Gemini** gets two new entry points:

- `geminiAudio()` for Lyria 3 Pro and Lyria 3 Clip music generation. Lyria Pro reads duration from the natural-language prompt; Clip is fixed at 30 seconds and returns MP3.
- A new `gemini-3.1-flash-tts-preview` TTS model with 70+ languages, 200+ audio tags, and multi-speaker dialogue via `multiSpeakerVoiceConfig`.

**Fal** gets three tree-shakeable adapters:

- `falSpeech()` for TTS via `fal-ai/gemini-3.1-flash-tts`, `fal-ai/minimax/speech-2.6-hd`, and the `fal-ai/kokoro/*` family.
- `falTranscription()` for STT via `fal-ai/whisper`, `fal-ai/wizper`, and `fal-ai/speech-to-text/turbo`.
- `falAudio()` for music, SFX, and the wider fal catalog: audio-to-audio, voice conversion and cloning, enhancement, separation, isolation, understanding, and merge.

All four follow the tree-shakeable subpath-import pattern, so your bundle only grows by the adapters you actually import.

## Try it

The new activity is live in `@tanstack/ai` and the two provider packages:

```bash
pnpm add @tanstack/ai @tanstack/ai-fal
# or
pnpm add @tanstack/ai @tanstack/ai-gemini
```

Then open the [audio generation guide](/ai/docs/media/audio-generation) for the full adapter matrix, or pull the `ts-react-chat` example to see working TTS and transcription tabs plus a `/generations/audio` route covering Lyria and fal side by side.

**Star [TanStack AI on GitHub](https://github.com/TanStack/ai)** if you want to see where this goes next.
