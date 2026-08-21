---
title: 'TanStack AI Enters the RC Phase'
published: 2026-08-21
excerpt: TanStack AI enters the release candidate phase. The architecture is locked in, with 24 providers, AG-UI, media generation, MCP, sandboxes, and persistence.
library: ai
authors:
  - Alem Tuzlak
  - Jack Herrington
  - Tom Beckenham
---

The journey of TanStack AI started with a humble `chat()` method, four providers, a custom protocol with ambitious goals, and two people who wanted to make working with AI great.

We've come a long way since then. We made our adapters small and tree-shakable. We grew from four providers to 24, and that number continues to increase. We adopted AG-UI as our official protocol, which is supported by more than 20 agent frameworks across many programming languages. That means you can bring TanStack AI into virtually any stack, on either the client or the server.

We've also expanded into areas such as media generation, MCP, sandboxing, agent harnesses, and much more.

A tremendous amount of work has gone into building something we're truly proud of: not just an easy way to chat with an LLM provider, but an entire ecosystem built for AI.

Today, TanStack AI officially enters the release candidate phase.

## The Journey So Far

_Cue "Carry On Wayward Son" by Kansas._

We've been very busy.

Our initial goal was to create an architecture that could be easily extended not only by us, but also by third parties. Over the past year, we've achieved that.

One of the biggest payoffs since we started has been making the right architectural decisions early and building everything on top of those foundations. One of the strongest parts of that architecture is our middleware system.

You can build just about anything with middleware. Chat persistence, agent harnesses running inside sandboxes, memory, telemetry, durability, and many other features are simply middleware functions that you pass into your `chat()` method.

Another powerful feature we offer is lazy tool calling, which can help reduce token costs with a simple Boolean flag. We also support advanced interrupt scenarios driven by your schemas. You can modify tool-call arguments, trigger multiple interrupts, and mix and match these capabilities while keeping everything completely type-safe from end to end.

### Transport Without Lock-In

Another area we wanted to get right was transport.

We don't want to lock you into a particular way of building applications. From the beginning, our goal has been not to dictate how you work, but to adapt to your needs and provide the primitives you need to succeed.

That philosophy is reflected across our entire API surface, and transport is no exception.

We currently provide first-party primitives for streaming through classic SSE, WebSockets, and HTTP streams, as well as support for Cap'n Web. You can also build custom adapters to stream over something even more specialized.

On the client, these streams are consumed through custom connection types, giving you complete control over your transport layer from end to end.

### Consistency and a Minimal API Surface

We also care deeply about consistency and keeping the API surface as small as possible.

Choosing your transport, backend, and frontend is one thing. But what happens when you need to add image generation, video generation, audio generation, transcription, or real-time audio?

The APIs are intentionally nearly identical. You learn the pattern once (or your agent does), and then simply swap the adapters.

Every media hook follows almost the exact same structure. The properties passed between the client and server remain consistent. Every API feels familiar, regardless of the modality you're working with.

We don't force you to learn 20 completely different APIs.

Learn the system once, and you'll be ready for whatever comes next.

### Type Safety at the Core

Then there's type safety, something we're known for.

Our type system sits at the core of the product, with enough compile-time errors to make your head spin, but in a good way.

Passed an unsupported model option? Error.

Forgot to provide a required property after enabling persistence? Error.

Passed a provider-specific tool to a model that doesn't support it? Error.

We help you catch problems early so you can ship to production with confidence, regardless of the complexity of your application.

## Biggest Feature Highlights

### The `chat()` Method

The core of TanStack AI is its `chat()` method.

It's a powerhouse that supports both direct conversations with LLM providers and sandboxed agent harnesses. It is packed with composable features that allow it to become as powerful as your application needs it to be.

Those features include persistence and durability, which allow users to refresh the browser, switch between conversations, and continue receiving updates in real time from exactly where they left off.

You can also sandbox your agents. For example, you can run Codex inside a remote or local sandbox, give it a task, and have it report the results back to your application.

The `chat()` method also supports telemetry, structured outputs, model-specific type safety, an ever-growing provider list, and multi-turn structured outputs that let users continue talking to an LLM while receiving structured results between turns.

Then there's code mode: a powerful feature that allows agents to write code and execute it inside isolates. This can improve tool-calling performance, optimize costs, and reduce response times.

Add MCP support, generic interrupts, and everything else in the system, and `chat()` becomes the foundation for applications ranging from simple assistants to sophisticated agent platforms.

### Media and Generation

We treat generation APIs as first-class features. They aren't afterthoughts bolted onto the framework for the five people who might use them.

We support real-time audio, text-to-speech, image generation, video generation, audio generation, transcription, and music generation. These APIs are considered stable and ready to use across more than 100 models.

Depending on your use case, we support either streaming work directly to the client or performing one-off generations. Switching between these approaches is seamless.

We also support passing images as references for new generations, provide access to a wide variety of models, and closely follow new developments across the field.

### Embeddings, Reranking, and Memory

For the RAG fans out there, we support embeddings and reranking through providers such as Cohere and OpenRouter.

We also support agent memory from every major vendor in the industry, allowing your agents to remember user preferences, retain context, and recall important facts across conversations.

### Sandboxes and Agent Harnesses

Our sandbox and agent-harness primitives allow you to build anything from a simple "fix this PR" agent to a sophisticated, Lovable-style application powered by conversational coding agents.

You can branch conversations, start multiple runs simultaneously, switch between them, show users several versions generated from the same prompt, persist every run, and make generated artifacts durable and easily accessible.

The entire system remains provider-agnostic.

We don't tell you to use Daytona, E2B, Vercel Sandboxes, or any other particular sandbox provider. You choose the infrastructure that works for you.

You can bring Codex, Claude Code, Grok, OpenCode, or any of the other ACP-compatible agents (more than 20 of them) and connect them to the same primitives.

We even give you the building blocks required to create a custom coding agent that runs locally, persists its runs to something like SQLite, uses memory, and incorporates whatever additional capabilities your application needs.

### MCP

Our MCP support is designed not only to let you connect to external MCP servers, but also to make those servers type-safe.

The TanStack AI MCP package includes a CLI that generates types for tools exposed by remote MCP servers, preserving type safety across the entire integration.

You can also create MCP connection pools and control their lifecycle. Your application can decide whether a chat should close a connection, keep it open, return it to a pool, or apply some other connection strategy.

### Persistence and Durability

Finally, our persistence story is one of the areas where TanStack AI truly shines.

We provide the primitives required to build stores that expose the data you need to persist conversations into your databases and services. You implement your store, run it against our conformance suite to verify that it behaves correctly, and then pass it into the persistence middleware.

At that point, you have fully persisted conversations.

Users can return after a month and continue exactly where they left off. Even if they refresh the website while a response is being generated, our pluggable durability adapters can persist the stream chunks in memory, Durable Streams, or another supported system.

When the user reconnects, they can resume the stream without missing anything.

Excluding the store implementation itself, this entire setup requires roughly 20 lines of code.

## What We're Proud Of

We're a team of three people working on TanStack AI in our free time.

It has been a difficult journey, but we've built something genuinely remarkable. TanStack AI has grown from an early prototype into a feature-rich, carefully structured project.

We wanted to highlight what each of us is most proud of.

> **Jack:** The simplicity and flexibility of the API architecture. For example, the amount we've been able to accomplish simply by extending the middleware and tool mechanisms.

> **Tom:** The type safety and the care taken with the core design are things I'm really proud of. It's elegantly designed. The persistence and durability systems are pretty amazing as well. I'm also proud that it works regardless of which hosting platform or provider you use, and that we treated every capability with the same level of care.

> **Alem:** These guys left me with nothing to highlight. I'm proud of the team, what we've accomplished, and the architecture, I guess...

## What's Next?

Now, it comes down to you.

We want to make sure we've built the best framework for creating AI-powered applications, and for having fun while doing it.

Try it out. Experiment with it. Solve interesting problems. Join our Discord, talk about what you're working on, and show us what you've built.

It makes our day whenever we discover that someone is using TanStack AI, especially when we see the variety of things people are creating: generating manga panels, helping their users, building software factories, running agent harnesses, and much more.

As maintainers, we plan to keep shipping features as the industry introduces new capabilities. While we wait for the next wave of innovation, we also have ambitious plans for advanced scenarios now that the core architecture is locked in.

That includes agent workflows and orchestration, which will unlock capabilities such as running agents in parallel, scheduling recurring agent jobs, coordinating complex workflows, and much more.

We also plan to add more providers and close the remaining gaps in our ecosystem.

Community contributions are always welcome, whether you want to add an LLM provider, sandbox provider, durability provider, or an entirely new idea we haven't considered.

Above everything else, we're proud to be a truly open-source AI and agent framework.

We don't have a commercial roadmap, a product to upsell, or a hidden agenda. Community pull requests are welcome. Ideas are encouraged. Helping everyone make TanStack AI better is the goal.

No feature request is too small. No idea is inherently bad. No discussion is overlooked.

It might take us a little time to get to everything, so please be patient with us. We're only three people building this in our spare time.

## Thank You

None of this would have been possible without the enormous support of our partners and community.

From OpenRouter supporting TanStack AI from the beginning to community members opening dozens of pull requests for small fixes, reporting issues, sharing feedback, and talking about what we've built, we're incredibly grateful.

We invite you to help us test TanStack AI as we approach a stable v1 release, which is now very close. The release candidate label probably gave that away already.

Report any feedback you have, tell us what works, tell us what doesn't, and above all:

Have fun building.
