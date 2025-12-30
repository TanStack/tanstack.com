---
title: 'The ai() Function That Almost Was'
published: 2025-12-26
authors:
  - Alem Tuzlak
---

![The ai() Function That Almost Was](/blog-assets/tanstack-ai-the-ai-function-postmortem/header.jpg)

We spent eight days building an API we had to kill. Here's what happened.

## The Dream

One function to rule them all. One function to control all adapters. One function to make it all typesafe.

```ts
import { ai } from '@tanstack/ai'
import { openaiText, openaiImage, openaiSummarize } from '@tanstack/ai-openai'

// text generation
ai({
  adapter: openaiText('gpt-4'),
  // ... text options
})

// image generation
ai({
  adapter: openaiImage('dall-e-3'),
  // ... image options
})

// summarization
ai({
  adapter: openaiSummarize('gpt-4'),
  // ... summary options
})
```

Simple. Single function. Powers everything AI-related. Clear naming. You're using AI. Types constrained to each adapter's capabilities. Pass image options to an image adapter, text options to a text adapter.

Change models? Type errors if something's not supported. Change adapters? Type errors if something's not supported.

It felt powerful. Switching between adapters was fast. We were excited.

It was a failure.

## Why It Failed

Two things killed it: complexity and tree-shaking.

### The Complexity Trap

The simplicity of `ai()` for end users hid enormous implementation complexity.

**Attempt 1: Function Overloads**

We tried using function overloads to constrain each adapter's options. Too many scenarios. The overloads resolved to wrong signatures. You could end up providing video options instead of image options. We got it to 99% working, but the 1% felt wrong and was a bigger hurdle than you'd think.

Having 10+ overloads is cumbersome. Get the order wrong and it all falls apart. This would exponentially increase the difficulty of contributions and lowered our confidence in shipping stable releases.

**Attempt 2: Pure Inference**

We tried TypeScript inference instead. It actually worked. Everything inferred perfectly. Types constrained to models. Life was good. Coconuts were rolling on the beach.

But the inference code was 50-100 lines just to cover text, image, and audio. It would grow with more modalities and grow again with type safety improvements. After thorough analysis it was almost impossible to reason about. A single glance and understanding was out the window.

We'll take complexity on our side over forcing you to use `as` casts or `any` types. But where this API completely failed was in our options factories.

### The aiOptions Nightmare

We added a `createXXXOptions` API. `createTextOptions`, `createImageOptions`, etc. You can construct options as ready-made agents and pass them into functions, overriding what you need.

To match the theme, we called it `aiOptions`. It would constrain everything to the modality and provider:

```ts
const opts = aiOptions({
  adapter: openaiText('gpt-4'),
})

ai(opts)
```

Here's where we hit the wall.

When `aiOptions` returned readonly values, spreading into `ai()` worked. But `aiOptions` was loosely typed. You could pass anything in.

When we fixed `aiOptions` to accept only valid properties, the spread would cast the `ai()` function to `any`. Then it would accept anything.

We went in circles. Get one part working, break another. Fix that, break the first thing.

I believe it could have been done. Our approach was probably just wrong. Some subtle bug in the system causing everything to break. But that proves the point: it was too complex to wrap your head around and find the root cause. Any fix would have to propagate through all the adapters. Very costly.

We spent almost a week trying to get this API to work perfectly. We couldn't. Maybe another week would have done it. But then what? How would we fix bugs in this brittle type system? How would we find root causes?

Even if we'd gotten it working, there was another problem.

### Tree-Shaking

We'd just split our adapters into smaller pieces so bundlers could tree-shake what you don't use. Then we put all that complexity right back into `ai()`.

We don't want to be the lodash of AI libraries, bundling everything you don't use and calling it a day. If a huge adapter that bundles everything is not okay, a single function that does the same thing is definitely not okay.

## The Warnings We Missed

Here's the part that stings.

### LLMs Couldn't Write It

We wrestled with the API for six days before reverting, then two more days to unwind it. Eight days total.

The warning sign we missed? LLMs couldn't reliably generate code for this API.

Think about that. We're building tools for AI, and AI couldn't figure out how to use them. That should have been a massive clue that humans wouldn't reliably write to this API unaided either.

LLMs like function names that indicate what the thing does. `ai()`? Who knows. `generateImage()`? Crystal clear.

When we finally asked the LLMs directly what they thought of the API, they were 4-0 against `ai()` and for the more descriptive approach we ended up with.

### Agents Hid the Pain

We used agents to do the implementation work. That hid the struggle from us.

If we'd been writing the code by hand, we would have _felt_ the challenge of wrestling with the types. That probably would have stopped the idea early.

LLMs won't bark when you tell them to do crazy stuff. They won't criticize your designs unless you ask them to. They just try. And try. And eventually produce something that technically works but shouldn't exist.

### We Skipped the Vetting

We were so confident in the design that we didn't make an RFC. Didn't get external feedback. Didn't run it by the LLMs themselves.

This is the classic trap. Smart people in a room, design something cool, pat each other on the backs, not realizing they left off a key detail or two. Go build the simple new thing, and it turns into a nightmare.

These situations are almost unavoidable. The only optimization is to cut them off early. Which we could have done if we'd:

1. Written code by hand before automating it
2. Asked the LLMs what they thought of the API
3. Made an RFC and gotten feedback
4. Noticed that the agents were struggling

## What We Explored Instead

Before landing on separate functions, we tried one more thing: an adapter with sub-properties.

```ts
const adapter = openai()
adapter.image('model')
adapter.text('model')
```

Looks nicer. Feels more unified. Same problem: still bundles everything.

We could have done custom bundling in TanStack Start to strip unused parts, but we don't want to force you to use our framework for the best experience. This library is for the web ecosystem, not just TanStack users.

## Where We Landed

Separate functions. `chat()`, `generateImage()`, `generateSpeech()`, `generateTranscription()`.

```ts
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'

chat({
  adapter: openaiText('gpt-4'),
  temperature: 0.6,
})
```

It's not as clever. That's the point.

You know what `chat()` does. You know what `generateImage()` does. LLMs know what they do. Your bundle only includes what you import. The types are simple enough to reason about.

Like a lot of things in life, there has to be compromise between complexity, DX, and UX. We decided to keep the core simple, split features into separate bundles, and make modalities easy to pull in or ignore.

## Lessons

1. **If LLMs can't write to your API, reconsider.** It's a signal that humans will struggle too.

2. **Don't let agents hide the pain.** Write code by hand before automating. Feel the friction yourself.

3. **Vet designs externally.** RFC it. Get feedback. Ask the LLMs what they think.

4. **Simple and clear beats clever.** APIs shouldn't surprise you. Function names should say what they do.

5. **Cut early.** These traps are almost unavoidable. The win is recognizing them fast.

We loved the `ai()` API. We built it. We had to kill it. That's how it goes sometimes.

---

_Ready to try what we shipped instead? Read [TanStack AI Alpha 2: Every Modality, Better APIs, Smaller Bundles](/blog/tanstack-ai-alpha-2)._
