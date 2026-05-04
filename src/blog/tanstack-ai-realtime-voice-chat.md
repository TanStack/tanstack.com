---
title: 'Talk to Your AI: Realtime Voice Chat in TanStack AI'
published: 2026-03-12
excerpt: Text-based chat is table stakes. TanStack AI now ships first-class support for realtime voice conversations — real voice, real time, with the AI hearing you, thinking, and responding naturally.
library: ai
authors:
  - Alem Tuzlak
---

![Talk to Your AI: Realtime Voice Chat in TanStack AI](/blog-assets/tanstack-ai-realtime-voice-chat/header.webp)

Text-based chat is table stakes. The next wave of AI applications is conversational — real voice, real time, with the AI hearing you, thinking, and responding as naturally as a phone call. TanStack AI now ships first-class support for **realtime voice conversations**, with a clean provider-agnostic architecture, client-side tool execution, multimodal input, and a React hook that makes the whole thing feel like building a form.

Two providers are supported out of the box: **OpenAI Realtime** (via WebRTC) and **ElevenLabs** (via WebSocket). The adapter system means more providers can slot in without touching your application code.

## The Architecture: Tokens on the Server, Connections on the Client

Realtime voice chat has a fundamental constraint that text chat doesn't: the audio stream connects **directly from the browser to the provider**. You can't proxy a WebRTC session through your server. But you also can't ship your API key to the client.

TanStack AI solves this with a **token/connection split**:

1. Your server generates a short-lived ephemeral token using `realtimeToken()` — this never exposes your API key
2. Your client uses that token to establish a direct connection via a provider-specific adapter
3. Audio capture, playback, tool execution, and state management all happen client-side through `useRealtimeChat`

The token is the only thing that crosses your server boundary. Everything else is a direct browser-to-provider stream.

## Server Side: One Function, Any Provider

The server-side surface is intentionally tiny. Generate a token, return it to the client:

```typescript
import { realtimeToken } from '@tanstack/ai'
import { openaiRealtimeToken } from '@tanstack/ai-openai'

// In your API route / server function
const token = await realtimeToken({
  adapter: openaiRealtimeToken({
    model: 'gpt-realtime-1.5',
  }),
})

// Return `token` to the client
```

For ElevenLabs, swap the adapter:

```typescript
import { elevenlabsRealtimeToken } from '@tanstack/ai-elevenlabs'

const token = await realtimeToken({
  adapter: elevenlabsRealtimeToken({
    agentId: process.env.ELEVENLABS_AGENT_ID!,
  }),
})
```

That's the entire server-side implementation. The token adapters handle the provider-specific session creation (OpenAI's `/v1/realtime/sessions` endpoint, ElevenLabs' signed URL generation) and return a uniform `RealtimeToken` with `token`, `expiresAt`, and `config`. The client auto-refreshes tokens before they expire.

## Client Side: `useRealtimeChat`

The React hook is where the magic happens. It manages the entire connection lifecycle, audio capture/playback, voice activity detection, tool execution, message state, and audio visualization — all behind a single hook:

```typescript
import { useRealtimeChat } from '@tanstack/ai-react'
import { openaiRealtime } from '@tanstack/ai-openai'

function VoiceChat() {
  const {
    // Connection
    status,       // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    error,
    connect,
    disconnect,

    // Conversation
    mode,         // 'idle' | 'listening' | 'thinking' | 'speaking'
    messages,
    pendingUserTranscript,
    pendingAssistantTranscript,

    // Voice control
    startListening,
    stopListening,
    interrupt,

    // Input
    sendText,
    sendImage,

    // Audio visualization
    inputLevel,
    outputLevel,
  } = useRealtimeChat({
    getToken: () => fetch('/api/realtime-token').then((r) => r.json()),
    adapter: openaiRealtime(),
    voice: 'alloy',
    instructions: 'You are a helpful voice assistant. Keep responses concise.',
  })

  return (
    <div>
      <p>Status: {status} | Mode: {mode}</p>

      {status === 'idle' ? (
        <button onClick={connect}>Start Conversation</button>
      ) : (
        <button onClick={disconnect}>End Conversation</button>
      )}

      {mode === 'speaking' && (
        <button onClick={interrupt}>Interrupt</button>
      )}
    </div>
  )
}
```

That's a working voice chat. The hook requests microphone access on connect, streams audio to the provider, plays back the AI's response, tracks transcripts in real time, and tears everything down on disconnect or unmount.

## What `mode` Tells You

The `mode` state gives you a single value that describes what's happening in the conversation right now:

| Mode        | What's Happening                                   |
| ----------- | -------------------------------------------------- |
| `idle`      | Silence — no one is speaking                       |
| `listening` | The user is speaking and the AI is hearing them    |
| `thinking`  | The AI received input and is generating a response |
| `speaking`  | The AI is producing audio output                   |

This is enough to build responsive UI indicators — pulsing microphone icons, thinking spinners, speaking animations — without managing multiple boolean flags.

## Voice Activity Detection: Three Modes

How does the system know when the user starts and stops talking? That's voice activity detection (VAD), and TanStack AI supports three modes:

```typescript
useRealtimeChat({
  // ...
  vadMode: 'server', // Provider detects speech server-side (default)
  vadMode: 'semantic', // Uses semantic understanding for turn boundaries (OpenAI only)
  vadMode: 'manual', // You control start/stop via startListening() / stopListening()
})
```

**Server VAD** is the simplest — the provider handles everything. **Semantic VAD** (OpenAI only) uses the model's understanding of conversation flow to decide when the user is done speaking, controlled by the `semanticEagerness` option (`'low'`, `'medium'`, `'high'`). **Manual** mode gives you full control for push-to-talk UIs:

```typescript
function PushToTalk() {
  const { connect, startListening, stopListening, mode } = useRealtimeChat({
    getToken: () => fetch('/api/realtime-token').then((r) => r.json()),
    adapter: openaiRealtime(),
    vadMode: 'manual',
    autoCapture: false,
  })

  return (
    <button
      onPointerDown={startListening}
      onPointerUp={stopListening}
    >
      {mode === 'listening' ? 'Release to Send' : 'Hold to Talk'}
    </button>
  )
}
```

## Tools: The Same Definitions, Running on the Client

The realtime system uses TanStack AI's isomorphic `toolDefinition()` system. Define your tool once with Zod schemas, implement it with `.client()`, and pass it directly to `useRealtimeChat`:

```typescript
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const getCurrentTime = toolDefinition({
  name: 'getCurrentTime',
  description: 'Get the current date and time.',
  inputSchema: z.object({
    timezone: z.string().optional(),
  }),
  outputSchema: z.object({
    time: z.string(),
    date: z.string(),
    timezone: z.string(),
  }),
}).client(({ timezone }) => {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date()
  return {
    time: now.toLocaleTimeString('en-US', { timeZone: tz }),
    date: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    }),
    timezone: tz,
  }
})

const getWeather = toolDefinition({
  name: 'getWeather',
  description: 'Get the current weather for a location.',
  inputSchema: z.object({
    location: z.string(),
  }),
  outputSchema: z.object({
    location: z.string(),
    temperature: z.number(),
    condition: z.string(),
  }),
}).client(async ({ location }) => {
  const res = await fetch(
    `/api/weather?location=${encodeURIComponent(location)}`,
  )
  return res.json()
})
```

Then pass them in:

```typescript
useRealtimeChat({
  getToken: () => fetch('/api/realtime-token').then((r) => r.json()),
  adapter: openaiRealtime(),
  tools: [getCurrentTime, getWeather],
  instructions: `You are a voice assistant with access to tools.
    You can tell the user the time and check the weather.
    Keep responses concise since this is voice.`,
})
```

When the AI decides to call a tool, the `RealtimeClient` executes it locally in the browser, sends the result back to the provider, and the AI continues talking with the tool's output. The user hears a natural response — "It's currently 72 degrees and sunny in San Francisco" — with no visible round-trip.

## Multimodal Input: Text and Images Alongside Voice

Voice is the primary input, but you're not limited to it. `sendText()` lets users type when voice isn't practical, and `sendImage()` (OpenAI only) lets users share images for the AI to see and discuss:

```typescript
function MultimodalChat() {
  const { sendText, sendImage, status } = useRealtimeChat({ /* ... */ })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]!
      sendImage(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      {/* Text fallback */}
      <form onSubmit={(e) => {
        e.preventDefault()
        const input = e.currentTarget.elements.namedItem('msg') as HTMLInputElement
        sendText(input.value)
        input.value = ''
      }}>
        <input name="msg" placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>

      {/* Image input */}
      <input type="file" accept="image/*" onChange={handleImageUpload} />
    </div>
  )
}
```

The user can be mid-conversation by voice, snap a photo, send it, and ask "What's in this image?" — all within the same realtime session.

## Audio Visualization

The hook exposes audio levels and raw frequency/time-domain data for building visualizations:

```typescript
const {
  inputLevel, // 0-1 normalized microphone volume
  outputLevel, // 0-1 normalized speaker volume
  getInputFrequencyData, // Uint8Array — FFT frequency bins
  getOutputFrequencyData,
  getInputTimeDomainData, // Uint8Array — waveform samples
  getOutputTimeDomainData,
} = useRealtimeChat({
  /* ... */
})
```

`inputLevel` and `outputLevel` update on every animation frame while connected — use them for simple volume bars:

```typescript
<div className="h-2 bg-gray-700 rounded-full overflow-hidden">
  <div
    className="h-full bg-green-500 transition-all duration-75"
    style={{ width: `${inputLevel * 100}%` }}
  />
</div>
```

For waveform or frequency visualizations, use the raw data getters with a canvas:

```typescript
function Waveform({ getData }: { getData: () => Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frameId: number
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const data = getData()

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2

      const sliceWidth = canvas.width / data.length
      let x = 0
      for (let i = 0; i < data.length; i++) {
        const y = (data[i]! / 255) * canvas.height
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.stroke()
      frameId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frameId)
  }, [getData])

  return <canvas ref={canvasRef} width={200} height={40} />
}

// Usage
<Waveform getData={getInputTimeDomainData} />
<Waveform getData={getOutputTimeDomainData} />
```

## Live Transcripts

While the user or assistant is speaking, you get streaming transcription via `pendingUserTranscript` and `pendingAssistantTranscript`. These update in real time as speech is recognized and are cleared when the final message is committed to `messages`:

```typescript
{pendingUserTranscript && (
  <p className="italic opacity-60">{pendingUserTranscript}...</p>
)}

{pendingAssistantTranscript && (
  <p className="italic opacity-60">{pendingAssistantTranscript}...</p>
)}
```

Final messages land in the `messages` array as `RealtimeMessage` objects with typed `parts` — `text`, `audio` (with transcript), `image`, `tool-call`, and `tool-result`:

```typescript
messages.map((msg) => (
  <div key={msg.id}>
    {msg.parts.map((part, i) => {
      if (part.type === 'audio') return <p key={i}>{part.transcript}</p>
      if (part.type === 'text') return <p key={i}>{part.content}</p>
      if (part.type === 'image') return <img key={i} src={`data:${part.mimeType};base64,${part.data}`} />
      return null
    })}
    {msg.interrupted && <span>(interrupted)</span>}
  </div>
))
```

## Interruptions

Users can interrupt the AI mid-sentence — just start talking (with server/semantic VAD) or call `interrupt()` programmatically. The AI stops speaking, the interrupted message is marked with `interrupted: true`, and the conversation continues naturally. The `onInterrupted` callback fires so you can update UI state:

```typescript
useRealtimeChat({
  // ...
  onInterrupted: () => {
    console.log('User interrupted the AI')
  },
})
```

## Session Configuration

The full set of session options covers everything you need to tune the voice experience:

```typescript
useRealtimeChat({
  getToken: () => fetch('/api/realtime-token').then((r) => r.json()),
  adapter: openaiRealtime(),

  // Personality
  instructions: 'You are a pirate. Respond in pirate speak.',
  voice: 'coral', // alloy, ash, ballad, coral, echo, sage, shimmer, verse

  // Generation
  temperature: 0.9, // 0.6–1.2 for OpenAI realtime
  maxOutputTokens: 500,

  // Output control
  outputModalities: ['audio', 'text'], // or just ['text'] for text-only responses

  // VAD
  vadMode: 'semantic',
  semanticEagerness: 'medium', // low = waits longer, high = responds faster

  // Audio
  autoPlayback: true, // auto-play AI audio (default: true)
  autoCapture: true, // request mic on connect (default: true)

  // Tools
  tools: [getCurrentTime, getWeather],

  // Callbacks
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  onMessage: (msg) => console.log('New message:', msg),
  onModeChange: (mode) => console.log('Mode:', mode),
  onError: (err) => console.error('Error:', err),
  onInterrupted: () => console.log('Interrupted'),
})
```

## Switching Providers at Runtime

Because adapters are just objects, you can switch providers based on user choice without restructuring your code:

```typescript
function VoiceChat({ provider }: { provider: 'openai' | 'elevenlabs' }) {
  const adapter =
    provider === 'openai' ? openaiRealtime() : elevenlabsRealtime()

  const { status, connect, disconnect, messages, mode } = useRealtimeChat({
    getToken: () =>
      fetch('/api/realtime-token', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      }).then((r) => r.json()),
    adapter,
    voice: 'alloy',
  })

  // Same UI regardless of provider
  // ...
}
```

The server token endpoint picks the right adapter too:

```typescript
// Server
async function handleTokenRequest(provider: string) {
  if (provider === 'openai') {
    return realtimeToken({
      adapter: openaiRealtimeToken({ model: 'gpt-realtime-1.5' }),
    })
  }
  if (provider === 'elevenlabs') {
    return realtimeToken({
      adapter: elevenlabsRealtimeToken({
        agentId: process.env.ELEVENLABS_AGENT_ID!,
      }),
    })
  }
  throw new Error(`Unknown provider: ${provider}`)
}
```

## Using the Client Directly (Without React)

If you're not using React — or need lower-level control — the `RealtimeClient` class from `@tanstack/ai-client` provides the same functionality without framework coupling:

```typescript
import { RealtimeClient } from '@tanstack/ai-client'
import { openaiRealtime } from '@tanstack/ai-openai'

const client = new RealtimeClient({
  getToken: () => fetch('/api/realtime-token').then((r) => r.json()),
  adapter: openaiRealtime(),
  instructions: 'You are a helpful assistant.',
  voice: 'alloy',
  tools: [getCurrentTime, getWeather],
  onStatusChange: (status) => console.log('Status:', status),
  onModeChange: (mode) => console.log('Mode:', mode),
  onMessage: (msg) => console.log('Message:', msg),
})

// Connect
await client.connect()

// Listen to state changes
const unsub = client.onStateChange((state) => {
  console.log('Pending transcript:', state.pendingUserTranscript)
})

// Send text when voice isn't available
client.sendText('What time is it?')

// Send an image (OpenAI only)
client.sendImage(base64Data, 'image/png')

// Interrupt the AI
client.interrupt()

// Manual VAD control
client.startListening()
client.stopListening()

// Access audio visualization
console.log(client.audio?.inputLevel)

// Clean up
await client.disconnect()
client.destroy()
```

This is how you'd integrate realtime voice into Solid, Vue, Svelte, or any other framework — wrap the `RealtimeClient` in your framework's reactivity primitives.

## Ideas: What You Could Build

The realtime system gives you the building blocks. Here's what falls out of them:

**Voice-controlled dashboards** — "Show me last week's revenue" triggers a tool that queries your analytics API. The AI reads back the numbers while the dashboard updates in real time.

**Multimodal customer support** — users describe a problem by voice, send a screenshot, and the AI sees both. Tool calls look up their account, check order status, or file a ticket — all executed client-side.

**Language tutoring** — semantic VAD with low eagerness gives students time to think. The AI listens patiently, then responds with corrections. `pendingUserTranscript` shows what's being heard so students can self-correct.

**Accessibility interfaces** — voice in, voice out, with text transcripts for deaf-accessible screen reading. `outputModalities: ['audio', 'text']` gives you both simultaneously.

**Field data collection** — a technician inspects equipment, describes what they see, sends photos, and the AI logs structured data via tool calls. Push-to-talk with `vadMode: 'manual'` works in noisy environments.

## Getting Started

```bash
# Core + React hook
pnpm add @tanstack/ai @tanstack/ai-client @tanstack/ai-react

# Pick your provider
pnpm add @tanstack/ai-openai        # OpenAI Realtime (WebRTC)
pnpm add @tanstack/ai-elevenlabs    # ElevenLabs (WebSocket)
```

Set your API key in the environment:

```bash
OPENAI_API_KEY=sk-...
# or
ELEVENLABS_API_KEY=...
```

The full documentation is available in the [Realtime Voice Chat Guide](https://tanstack.com/ai/latest/docs/guides/realtime-chat).
