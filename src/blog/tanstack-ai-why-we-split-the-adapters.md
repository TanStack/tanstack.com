---
title: "Why We Split the Adapters"
published: 2026-01-02
authors:
  - Alem Tuzlak
---

With the latest release we brought a major architectural change to how we do adapters. Instead of one monolithic adapter that does everything, we split into smaller adapters—each in charge of a single functionality.

Here's why.

## The Problem

We need to support:

- Text generation
- Audio generation
- Video generation
- Text-to-speech
- Transcription
- Summarization
- And more to come

We're a small team. We don't have infinite funds or a lot of people to help iterate and add functionalities. We can't afford mistakes that slow us down. The adapters for providers are the biggest bottleneck in the whole process, so getting this part right was crucial.

We were trying to solve three things: bundle splitting, ease of development, and a better type system.

## Bundle Splitting

We don't want to give you a single function that bundles every possible functionality into your code, leaving kilobytes of data you never even use.

The fix was straightforward: break up the monolith into micro-adapters. As every enterprise knows, this is the answer to all business problems—split it into micro-services. Or in our case, micro-adapters.

After the split, the single `openai` function turned into `openaiText`, `openaiImage`, `openaiSummarize`, and so on. You choose what you need. We give you the adapter to plug.

## Ease of Development

Imagine the old approach at scale:

1. Support 30 different adapters
2. Add image functionality
3. Update all 30 adapters that extend `BaseAdapter` to bring in image support
4. Make sure all of them work

That would take months to ship.

Here's how it looks with split adapters:

1. Support 30 different adapters
2. Add a new `BaseImageAdapter`
3. Update however many adapters we want—1 or 30—to export an image adapter with the implemented functionality
4. Incrementally roll out support for adapters we don't include in the initial release

This approach lets us be incremental and minimal in the surface area we impact. Supporting new functionalities becomes trivial because we don't have the overhead of adding it to every adapter at once.

We can move fast, add new features, and incrementally roll out support as the ecosystem grows. External contributors can add image support for the adapters they need by opening a PR with a few hundred lines of code. We can review it faster and merge it faster.

## Better Type System

Our `BaseAdapter` monolith had already grown to 7 type generics. And it only supported chat.

Now imagine adding all the other functionalities. We'd probably end up somewhere close to 20-30 generics. Good luck implementing a new adapter for a provider we don't support yet.

With the new approach, the generics max out at 3. It's easy to add new adapters. This lets external contributors help us out, and it lets us move through adapters with less complexity and in less time.

## What We Explored Instead

One idea was to create an adapter with sub-properties:

```ts
const adapter = openai()
adapter.image("model")
adapter.text("model")
```

Looks nicer. Feels more split. Same problem—it still bundles everything.

We could have used a custom bundling approach in TanStack Start to strip unused parts from the bundle. But we don't want to force you to use our framework for the best experience. This library is for the web ecosystem, not just TanStack users. That approach was out of the question.

## Where We Landed

We aimed to make TanStack AI easier for both maintainers and the community to get involved. We pulled it off.

The adapters are easy to make, easy to maintain, and easy to reason about. Your bundle size stays minimal. Our productivity stays high.

Out of all the possible outcomes, this one is the best. We're confident in the direction. We're confident you'll enjoy it too.

---

*See it in action: [TanStack AI Alpha 2: Every Modality, Better APIs, Smaller Bundles](/blog/tanstack-ai-alpha-2)*
