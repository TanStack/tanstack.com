---
title: 'TanStack AI Alpha: Your AI, Your Way'
published: 2025-12-04
authors:
  - Jack Herrington
  - Alem Tuzlak
  - Tanner Linsley
---

![TanStack AI Alpha](/blog-assets/tanstack-ai-alpha-your-ai-your-way/header.jpg)

**The TanStack team is excited to announce the alpha release of [TanStack AI](/ai), a framework-agnostic AI toolkit built for developers who want control over their stack.**

Let's be honest. The current AI landscape has a problem. You pick a framework, you pick a cloud provider, and suddenly you're locked into an ecosystem that dictates how you build. We think that's backwards.

TanStack AI takes a different approach. We're building the Switzerland of AI tooling. An honest, open source set of libraries (across multiple languages) that works with your existing stack instead of replacing it.

## What's in the Alpha

**Server support across multiple languages.** We're shipping with JavaScript/TypeScript, PHP, and Python support out of the gate. All three support full agentic flows with tools. (Python and PHP have not yet been released to the appropriate package systems.)

**Adapters for the providers you actually use.** TypeScript adapters for OpenAI, Anthropic, Gemini, and Ollama. The TypeScript server library also handles summarizations and embeddings.

**An open, published protocol.** We've documented exactly how the server and client communicate. Use whatever language you want. Use whatever transport layer you want. HTTP, websockets, smoke signals. As long as you speak the protocol through a connection adapter, our client will work with your backend.

**Isomorphic Tool Support.** Define your tools once with meta definitions, then provide isolated server and client implementations. This architecture gives you type safety that actually works across your entire application.

**Client libraries that meet you where you are.** Vanilla JS, React, and Solid are ready now. Svelte and more are on the way.

**Real examples that actually ship.** We're not just giving you docs, we're giving you working code:

- [TanStack Start](/start) with React

- [TanStack Start](/start) with Solid

- PHP with Slim running a Vanilla client

- Laravel with React (coming soon)

- Python FastAPI with Vanilla frontend

- A multi-user group chat built on [TanStack Start](/start) using Cap'n'Web RPC and websockets

**Per-model type safety that actually matters.** Every provider has different options. Every model supports different modalities. Text, audio, video, tools. We give you full typing for providerOptions on a per-model basis, so your IDE knows exactly what each model can do. No more guessing. No more runtime surprises.

**Isomorphic devtools.** A full AI devtools panel that gives you unparalleled insight into what the LLM is doing on both sides of the connection. See what's happening on the server. See what's happening on the client. Debug your AI workflows the way you debug everything else. Built on [TanStack Devtools](/devtools).

## Coming Soon

**Headless chatbot UI components.** Think Radix, but for AI chat interfaces. Fully functional, completely unstyled components for React and Solid that you can skin to match your application. You handle the look and feel, we handle the complexity underneath. Similar to how [TanStack Table](/table) and [TanStack Form](/form) work.

## The Catch

The only catch is that we're still in alpha. There will be bugs. There will be rough edges. There will be things that don't work as expected. We're not perfect. But we're honest. We're transparent. We're here to help. We're here to make building AI applications easier. What we are looking for is your feedback. Your suggestions. Your ideas. We're not done yet. But we're here to build the best AI toolkit possible.

We are also taking a lot on here. All the TanStack teams are small and totally volunteer. So if you want to step up to help us build adapters, or help us work on the Python or PHP support, or really anything, we are here for it.

## Why We Built This

TanStack AI exists because developers deserve better. We're not selling a service. There's no platform to migrate to. No vendor lock-in waiting around the corner. Nor will there ever be.

Just real honest open source tooling from the team you trust that has been shipping framework-agnostic developer tools for years. We've always had your back, and that's not changing now.
