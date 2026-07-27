---
title: TanStack + OpenRouter Partnership
published: 2026-03-09
excerpt: OpenRouter is an official TanStack sponsor, with a first-class TanStack AI adapter for accessing hundreds of models through one API.
authors:
  - Tanner Linsley
---

![TanStack + OpenRouter](/blog-assets/openrouter-partnership/header.png)

**OpenRouter is now an official TanStack sponsor.** The most concrete expression of that is already shipped: [`@tanstack/ai-openrouter`](https://tanstack.com/ai/latest/docs/adapters/openrouter), a first-class TanStack AI adapter that gives you access to hundreds of models through one API.

## Why OpenRouter

When we started building TanStack AI, one of our core beliefs was that you shouldn't have to bet your integration on a single provider. The AI model landscape is moving faster than anyone can predict. The model that wins this quarter might not be the one you want next quarter, and rewriting your AI layer every time a new frontier model drops is exactly the kind of undifferentiated toil we want to help you avoid.

OpenRouter solves this cleanly. One API key and one integration for GPT, Claude, Gemini, Llama, Mistral, DeepSeek, and whatever ships next. When you want to try a different model, you change a string. When a provider goes down, OpenRouter can route around it. That's the kind of leverage I want TanStack developers to have.

## The Adapter

```bash
npm install @tanstack/ai-openrouter
```

```typescript
import { chat } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'

const stream = chat({
  adapter: openRouterText('anthropic/claude-sonnet-4.5'),
  messages: [{ role: 'user', content: 'Hello!' }],
})
```

Swap the model string for any model in the [OpenRouter catalog](https://openrouter.ai/models?utm_source=tanstack). Everything else stays the same.

One feature I particularly love is the auto-router with fallbacks. It's dead simple to set up and gives your app real production resilience without any retry logic of your own:

```typescript
const stream = chat({
  adapter: openRouterText('openrouter/auto'),
  messages,
  modelOptions: {
    models: [
      'openai/gpt-5.5',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-3.1-pro-preview',
    ],
  },
})
```

If the primary model is unavailable, OpenRouter falls through the configured list. The fallback order stays in the request instead of becoming hand-written retry logic.

## Jack's Image Generation Demo

Our own Jack Herrington put together a demo showing off TanStack AI with the OpenRouter adapter to do image generation. It's a great look at how far this goes beyond just chat:

<iframe
  width="100%"
  style="aspect-ratio: 16/9;"
  src="https://www.youtube.com/embed/YOa99Wpzd3o"
  title="Generating Images With TanStack AI"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>

## What This Means Going Forward

The sponsorship supports ongoing maintenance and testing as TanStack AI and OpenRouter evolve. More importantly, both teams are aligned on the same goal: give developers a flexible AI integration without locking them into a single model provider.

If you're building AI features with TanStack, the OpenRouter adapter is the one I'd reach for first.

- [TanStack AI + OpenRouter docs](https://tanstack.com/ai/latest/docs/adapters/openrouter)
- [Browse OpenRouter models](https://openrouter.ai/models?utm_source=tanstack)
