---
title: 'TanStack AI Alpha 2: Every Modality, Better APIs, Smaller Bundles'
published: 2025-12-19
draft: true
authors:
  - Alem Tuzlak
  - Jack Herrington
  - Tanner Linsley
---

It's been two weeks since we released the first alpha of TanStack AI. To us, it feels like decades ago. We've prototyped through 5-6 different internal architectures to bring you the best experience possible.

Our goals were simple: move away from monolithic adapters and their complexity, while expanding the flexibility and power of our public APIs. This release delivers on both.

## New Adapter Architecture

We wanted to support everything AI providers offer—image generation, video, audio, text-to-speech, transcription—without updating every adapter simultaneously.

We're a small team. Adding image support shouldn't mean extending `BaseAdapter`, updating 5+ provider implementations, ensuring per-model type safety for each, and combing through docs manually. That's a week per provider. Multiply that by 20 providers and 6 modalities.

So we split the monolith.

Instead of:

```ts
import { openai } from '@tanstack/ai-openai'
```

You now have:

```ts
import { openaiText, openaiImage, openaiVideo } from '@tanstack/ai-openai'
```

### Why This Matters

**Incremental feature support.** Add image generation to OpenAI this week, Gemini next week, video for a third provider the week after. Smaller releases, same pace.

**Easier maintenance.** Our adapter abstraction had grown to 7 type generics with only text, summarization, and embeddings. Adding 6 more modalities would have exploded complexity. Now each adapter is focused—3 generics max.

**Better bundle size.** You control what you pull in. Want only text? Import `openaiText`. Want text and images? Import both. Your bundle, your choice.

**Faster contributions.** Add support for your favorite provider with a few hundred lines. We can review and merge it quickly.

## New Modalities

What do we support now?

- Structured outputs
- Image generation
- Video generation
- Audio generation
- Transcription
- Text-to-speech

You have a use-case with AI? We support it.

## API Changes

We made breaking changes. Here's what and why.

### Model Moved Into the Adapter

Before:

```ts
chat({
  adapter: openai(),
  model: 'gpt-4',
  // now you get typesafety...
})
```

After:

```ts
chat({
  adapter: openaiText('gpt-4'),
  // immediately get typesafety
})
```

Fewer steps to autocomplete. No more type errors from forgetting to define the model.

### providerOptions → modelOptions

Quick terminology:

- **Provider**: Your LLM provider (OpenAI, Anthropic, Gemini)
- **Adapter**: TanStack AI's interface to that provider
- **Model**: The specific model (GPT-4, Claude, etc.)

The old `providerOptions` were tied to the _model_, not the provider. Changing from `gpt-4` to `gpt-3.5-turbo` changes those options. So we renamed them:

```ts
chat({
  adapter: openaiText('gpt-4'),
  modelOptions: {
    text: {},
  },
})
```

### Options Flattened to Root

Settings like `temperature` work across providers. Our other modalities already put config at the root:

```ts
image({
  adapter,
  numberOfImages: 3,
})
```

So we brought chat in line:

```ts
chat({
  adapter: openaiText('gpt-4'),
  modelOptions: {
    text: {},
  },
  temperature: 0.6,
})
```

Start typing to see what's available.

### The Full Diff

```diff
chat({
-  adapter: openai(),
+  adapter: openaiText("gpt-4"),
-  model: "gpt-4",
-  providerOptions: {
+  modelOptions: {
    text: {}
  },
-  options: {
-    temperature: 0.6
-  },
+  temperature: 0.6
})
```

## What's Next

**Standard Schema support.** We're dropping the Zod constraint for tools and structured outputs. Bring your own schema validation library.

**On the roadmap:**

- Middleware
- Tool hardening
- Headless UI library for AI components
- Context-aware tools
- Better devtools and usage reporting
- More adapters: AWS Bedrock, OpenRouter, and more

Community contributions welcome.

## Wrapping Up

We've shipped a major architectural overhaul, new modalities across the board, and a cleaner API. The adapters are easy to make, easy to maintain, and easy to reason about. Your bundle stays minimal.

We're confident in this direction. We think you'll like it too.

---

_Curious how we got here? Read [The `ai()` Function That Almost Was](/blog/tanstack-ai-the-ai-function-postmortem)—a post-mortem on the API we loved, built, and had to kill._
