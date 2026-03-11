---
title: 'Generation Hooks: Type-Safe AI Beyond Chat'
published: 2026-03-11
authors:
  - Alem Tuzlak
---

![Generation Hooks](/blog-assets/generation-hooks/header.png)

Chat is just the beginning. Most AI-powered apps need to generate images, convert text to speech, transcribe audio, summarize documents, or create videos. Until now, wiring up each of these meant custom fetch logic, manual loading state, bespoke error handling, and a different streaming protocol for every one.

TanStack AI now ships **generation hooks**: a unified set of React hooks (with Solid, Vue, and Svelte coming soon) that give you first-class primitives for every non-chat AI activity.

## One Pattern to Rule Them All

- `useGenerateImage()` for image generation
- `useGenerateSpeech()` for text-to-speech
- `useTranscription()` for audio transcription
- `useSummarize()` for text summarization
- `useGenerateVideo()` for video generation

Every hook follows the same API surface. Learn one, know them all:

```tsx
const { generate, result, isLoading, error, stop, reset } = useGenerateImage({
  connection: fetchServerSentEvents('/api/generate/image'),
})

generate({ prompt: 'A neon-lit cyberpunk cityscape at sunset' })
```

`result` is fully typed. `error` is handled. Loading state is tracked. Abort is built in. No boilerplate, no `useEffect` spaghetti, no manual state management.

## Three Ways to Connect

Every generation hook supports three transport modes.

### 1. Streaming (Connection Adapter)

The classic SSE approach. Your server wraps the generation in `toServerSentEventsResponse()`, and the client consumes it through `fetchServerSentEvents()`:

```tsx
// Client
const { generate, result, isLoading } = useGenerateImage({
  connection: fetchServerSentEvents('/api/generate/image'),
})
```

```typescript
// Server (API route)
const stream = generateImage({
  adapter: openaiImage('gpt-image-1'),
  prompt: data.prompt,
  stream: true,
})
return toServerSentEventsResponse(stream)
```

Works with any server framework, any hosting provider, any deployment model.

### 2. Direct (Fetcher)

When you don't need streaming, the fetcher mode does exactly what it sounds like:

```tsx
const { generate, result, isLoading } = useGenerateImage({
  fetcher: (input) => generateImageFn({ data: input }),
})
```

The server function runs, returns JSON, the hook updates your UI. Simple, synchronous from the user's perspective, fully type-safe.

### 3. Server Function Streaming

This is the one we're most excited about. It combines the type safety of server functions with the real-time feedback of streaming, and it works beautifully with TanStack Start.

The problem: the `connection` approach uses a generic `Record<string, any>` for its data payload. Your input loses all type information. The `fetcher` approach is fully typed, but blocks until the entire result is ready.

Server Function Streaming gives you both. Your fetcher returns a `Response` (an SSE stream), and the client detects it automatically and parses the stream in real-time:

```tsx
// Client - identical API to a direct fetcher
const { generate, result, isLoading } = useGenerateImage({
  fetcher: (input) => generateImageStreamFn({ data: input }),
})
```

```typescript
// Server - add stream: true, wrap with toServerSentEventsResponse
export const generateImageStreamFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      prompt: z.string(),
      numberOfImages: z.number().optional(),
      size: z.string().optional(),
    }),
  )
  .handler(({ data }) =>
    toServerSentEventsResponse(
      generateImage({
        adapter: openaiImage('gpt-image-1'),
        prompt: data.prompt,
        stream: true,
      }),
    ),
  )
```

From the client's perspective the API is identical to a direct fetcher call. Behind the scenes, TanStack AI detects the `Response` object, reads the SSE stream, and feeds chunks through the same event pipeline as the connection adapter. Progress events fire in real-time. Errors are reported as they happen. Your `input` parameter stays fully typed throughout.

Zero config. If your fetcher returns a `Response`, it's treated as an SSE stream. If it returns anything else, it's a direct result.

## How It Works Under the Hood

When a fetcher returns a `Response`, the `GenerationClient` runs a simple check:

```typescript
const result = await this.fetcher(input, { signal })

if (result instanceof Response) {
  // Parse as SSE stream — same pipeline as ConnectionAdapter
  await this.processStream(parseSSEResponse(result, signal))
} else {
  // Use as direct result
  this.setResult(result)
}
```

`parseSSEResponse` reads the response body as a stream of newline-delimited SSE events, parses each `data:` line into a `StreamChunk`, and yields them into the same `processStream` method that the ConnectionAdapter uses. Same event types, same state transitions, same callbacks. Every feature that works with streaming connections works with server function streaming: progress reporting, chunk callbacks, abort signals, error handling.

## Result Transforms

Sometimes the raw result from the server isn't what you want in state. Every generation hook accepts an `onResult` callback that transforms the result before it's stored:

```tsx
const { result } = useGenerateSpeech({
  fetcher: (input) => generateSpeechStreamFn({ data: input }),
  onResult: (raw) => {
    const bytes = Uint8Array.from(atob(raw.audio), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: raw.contentType ?? 'audio/mpeg' })
    return {
      audioUrl: URL.createObjectURL(blob),
      format: raw.format,
      duration: raw.duration,
    }
  },
})

// result is typed as { audioUrl: string; format?: string; duration?: number } | null
```

TypeScript infers the output type from your transform. No explicit generics needed.

## Video Generation

Video generation is a different beast. Providers like OpenAI's Sora use a jobs-based architecture: submit a prompt, receive a job ID, poll for status until the video is ready. This can take minutes.

`useGenerateVideo()` handles all of this transparently:

```tsx
const { generate, result, jobId, videoStatus, isLoading } = useGenerateVideo({
  fetcher: (input) => generateVideoStreamFn({ data: input }),
})

{
  videoStatus && (
    <div>
      <p>Status: {videoStatus.status}</p>
      {videoStatus.progress != null && (
        <div
          className="progress-bar"
          style={{ width: `${videoStatus.progress}%` }}
        />
      )}
    </div>
  )
}
```

`jobId` and `videoStatus` are reactive state that update in real-time as the server streams polling updates. Your users see "pending", "processing", progress percentages, and finally the completed video URL. You write zero polling loops.

## Every Activity, Same API

| Hook                  | Input                                | Result                                          |
| --------------------- | ------------------------------------ | ----------------------------------------------- |
| `useGenerateImage()`  | `{ prompt, numberOfImages?, size? }` | `{ images: [{ url, b64Json, revisedPrompt }] }` |
| `useGenerateSpeech()` | `{ text, voice?, format? }`          | `{ audio, contentType, format, duration }`      |
| `useTranscription()`  | `{ audio, language? }`               | `{ text, segments, language, duration }`        |
| `useSummarize()`      | `{ text, style?, maxLength? }`       | `{ summary }`                                   |
| `useGenerateVideo()`  | `{ prompt, size?, duration? }`       | `{ jobId, status, url }`                        |

Same `generate()`. Same `result`. Same `isLoading`. Same `error`. Same `stop()` and `reset()`. The consistency is intentional: AI features should be as easy to add to your app as a form submission.

## Getting Started

```bash
pnpm add @tanstack/ai @tanstack/ai-react @tanstack/ai-client @tanstack/ai-openai
```

Create a streaming server function:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { generateImage, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiImage } from '@tanstack/ai-openai'

export const generateImageStreamFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ prompt: z.string() }))
  .handler(({ data }) =>
    toServerSentEventsResponse(
      generateImage({
        adapter: openaiImage('gpt-image-1'),
        prompt: data.prompt,
        stream: true,
      }),
    ),
  )
```

Use it in your component:

```tsx
import { useGenerateImage } from '@tanstack/ai-react'
import { generateImageStreamFn } from '../lib/server-fns'

function ImageGenerator() {
  const { generate, result, isLoading, error } = useGenerateImage({
    fetcher: (input) => generateImageStreamFn({ data: input }),
  })

  return (
    <div>
      <button onClick={() => generate({ prompt: 'A mountain at dawn' })}>
        {isLoading ? 'Generating...' : 'Generate'}
      </button>
      {result?.images.map((img, i) => (
        <img key={i} src={img.url} alt="Generated" />
      ))}
    </div>
  )
}
```

Three lines of hook setup. Type-safe input. Streaming progress. Error handling. Abort support.

## What's Next

Generation hooks are available now in `@tanstack/ai-client` and `@tanstack/ai-react`. Solid, Vue, and Svelte support is coming with the same API surface.

We're also expanding the adapter ecosystem so you can use these hooks with providers beyond OpenAI. The generation functions are provider-agnostic by design, so swapping from OpenAI to Anthropic or a local model is a single line change.

Build something and let us know what you make.
