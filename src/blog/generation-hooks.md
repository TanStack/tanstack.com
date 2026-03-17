---
title: 'Generation Hooks: Type-Safe AI Beyond Chat'
published: 2026-03-11
excerpt: Chat is just the beginning. Your AI app needs image generation, text-to-speech, transcription, and more. TanStack AI now ships generation hooks — a unified set of React hooks for every non-chat AI activity.
authors:
  - Alem Tuzlak
---

![Generation Hooks](/blog-assets/generation-hooks/header.png)

Chat is just the beginning. Your AI-powered app probably needs to generate images, convert text to speech, transcribe audio, summarize documents, or create videos. Until now, wiring up each of these activities meant writing custom fetch logic, managing loading states, handling errors, and juggling streaming protocols for every single one.

Not anymore.

## One Pattern to Rule Them All

TanStack AI now ships **generation hooks**: a unified set of React hooks (with Solid, Vue, and Svelte support) that give you first-class primitives for every non-chat AI activity:

- `useGenerateImage()` for image generation
- `useGenerateSpeech()` for text-to-speech
- `useTranscription()` for audio transcription
- `useSummarize()` for text summarization
- `useGenerateVideo()` for video generation

Every hook follows the exact same API surface. Learn one, and you know them all:

```tsx
const { generate, result, isLoading, error, stop, reset } = useGenerateImage({
  connection: fetchServerSentEvents('/api/generate/image'),
})

// That's it. Call generate() and your UI reacts.
generate({ prompt: 'A neon-lit cyberpunk cityscape at sunset' })
```

The `result` is fully typed. The `error` is handled. Loading state is tracked. Abort is built in. No boilerplate, no `useEffect` spaghetti, no manual state management.

## Three Ways to Connect

Every generation hook supports three transport modes, so you can pick the one that fits your architecture:

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

This is the most flexible option. It works with any server framework, any hosting provider, any deployment model.

### 2. Direct (Fetcher)

Sometimes you don't need streaming. You just want to call a function and get a result. The fetcher mode does exactly that:

```tsx
const { generate, result, isLoading } = useGenerateImage({
  fetcher: (input) => generateImageFn({ data: input }),
})
```

The server function runs, returns JSON, and the hook updates your UI. Simple, synchronous from the user's perspective, and fully type-safe.

### 3. Server Function Streaming (NEW)

This is the one we're most excited about. It combines the **type safety of server functions** with the **real-time feedback of streaming**, and it works beautifully with TanStack Start.

Here is the problem we solved: the `connection` approach uses a generic `Record<string, any>` for its data payload. Great for flexibility, but your input loses all type information. The `fetcher` approach is fully typed, but it waits for the entire result before updating the UI.

Server Function Streaming gives you both. Your fetcher returns a `Response` object (an SSE stream), and the client automatically detects it and parses the stream in real-time:

```tsx
// Client - looks identical to the direct fetcher
const { generate, result, isLoading } = useGenerateImage({
  fetcher: (input) => generateImageStreamFn({ data: input }),
})
```

```typescript
// Server - just add stream: true and wrap with toServerSentEventsResponse
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

From the client's perspective, the API is identical to a direct fetcher call. But behind the scenes, TanStack AI detects the `Response` object, reads the SSE stream, and feeds chunks through the same event pipeline used by the connection adapter. Progress events fire in real-time. Errors are reported as they happen. And your `input` parameter stays fully typed throughout.

The detection is simple and zero-config: if your fetcher returns a `Response`, it's treated as an SSE stream. If it returns anything else, it's treated as a direct result. No flags, no configuration, no separate hook.

## How It Works Under the Hood

When a fetcher returns a `Response`, the `GenerationClient` runs a simple check:

```typescript
const result = await this.fetcher(input, { signal })

if (result instanceof Response) {
  // Parse as SSE stream - same pipeline as ConnectionAdapter
  await this.processStream(parseSSEResponse(result, signal))
} else {
  // Use as direct result
  this.setResult(result)
}
```

The `parseSSEResponse` utility reads the response body as a stream of newline-delimited SSE events, parses each `data:` line into a `StreamChunk`, and yields them into the same `processStream` method that the ConnectionAdapter uses. Same event types, same state transitions, same callbacks.

This means every feature that works with streaming connections also works with server function streaming: progress reporting, chunk callbacks, abort signals, error handling. All of it.

## Result Transforms

Sometimes the raw result from the server isn't what you want to store in state. Every generation hook accepts an `onResult` callback that can transform the result before it's stored:

```tsx
const { result } = useGenerateSpeech({
  fetcher: (input) => generateSpeechStreamFn({ data: input }),
  onResult: (raw) => {
    // Convert base64 audio to a blob URL for playback
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

TypeScript infers the output type from your transform function. No explicit generics needed.

## Video Generation: A First-Class Citizen

Video generation is a different beast. Unlike image or speech generation, video providers like OpenAI's Sora use a jobs-based architecture: you submit a prompt, receive a job ID, then poll for status until the video is ready. This can take minutes.

`useGenerateVideo()` handles all of this transparently:

```tsx
const { generate, result, jobId, videoStatus, isLoading } = useGenerateVideo({
  fetcher: (input) => generateVideoStreamFn({ data: input }),
})

// In your JSX:
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

The hook exposes `jobId` and `videoStatus` as reactive state that updates in real-time as the server streams polling updates. Your users see "pending", "processing", progress percentages, and finally the completed video URL, all without you writing a single polling loop.

## Every Activity, Same API

Here's what makes this design special: the API is identical across all five generation types. Once you've built an image generation page, building a speech generation page is a matter of swapping the hook name and adjusting the input:

| Hook                  | Input                                | Result                                          |
| --------------------- | ------------------------------------ | ----------------------------------------------- |
| `useGenerateImage()`  | `{ prompt, numberOfImages?, size? }` | `{ images: [{ url, b64Json, revisedPrompt }] }` |
| `useGenerateSpeech()` | `{ text, voice?, format? }`          | `{ audio, contentType, format, duration }`      |
| `useTranscription()`  | `{ audio, language? }`               | `{ text, segments, language, duration }`        |
| `useSummarize()`      | `{ text, style?, maxLength? }`       | `{ summary }`                                   |
| `useGenerateVideo()`  | `{ prompt, size?, duration? }`       | `{ jobId, status, url }`                        |

Same `generate()`. Same `result`. Same `isLoading`. Same `error`. Same `stop()` and `reset()`. The consistency is intentional: we want AI features to be as easy to add to your app as a form submission.

## Getting Started

Install the packages:

```bash
pnpm add @tanstack/ai @tanstack/ai-react @tanstack/ai-client @tanstack/ai-openai
```

Create a server function that streams:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { generateImage, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiImage } from '@tanstack/ai-openai'

export const generateImageStreamFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ prompt: z.string() }))
  .handler(({ data }) => {
    return toServerSentEventsResponse(
      generateImage({
        adapter: openaiImage('gpt-image-1'),
        prompt: data.prompt,
        stream: true,
      }),
    )
  })
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

Three lines of hook setup. Type-safe input. Streaming progress. Error handling. Abort support. That's it.

## What's Next

Generation hooks are available now in `@tanstack/ai-client` and `@tanstack/ai-react`. Support for Solid, Vue, and Svelte is coming soon with the same API surface.

We're also working on expanding the adapter ecosystem so you can use these hooks with providers beyond OpenAI. The generation functions are provider-agnostic by design, so swapping from OpenAI to Anthropic or a local model will be a single line change.

Build something cool and let us know. We can't wait to see what you create.
