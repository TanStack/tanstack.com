---
title: 'TanStack AI 1.0: Build the AI Experience You Want'
published: 2026-10-23
draft: false
excerpt: 'TanStack AI 1.0 brings stable core APIs for building AI applications, with chat, media, voice, tools, and an experimental harness for longer-lived agents.'
library: ai
authors:
  - Alem Tuzlak
  - Jack Herrington
  - Tom Beckenham
---

![A stack of five stones on a beach at sunrise, with 1.0 carved into the bottom stone](/blog-assets/tanstack-ai-1-0/header.png)

TanStack AI 1.0 is here, and what matters most to me about this release is how much you can build with it.

We have the pieces for chat, voice, image generation, tools, and agents that keep working beyond a single request. You can use them to add a feature to an existing application, build an AI product of your own, or create the framework other people use to build theirs. I want TanStack AI to be a foundation you can choose without having to decide in advance what your entire application is going to become.

That includes people who aren't programmers. You should be able to describe the experience you want, tell your coding agent to use TanStack AI, and work with it to build that application. For developers who want to design every part themselves, the same typed APIs are there to use directly. Those are different ways of working with the same library, and both matter.

1.0 is our formal commitment to the APIs you build on. The core APIs are stable, and this release also introduces an experimental agent harness for longer-lived sessions. The work underneath covers model integrations, streaming, tools, media, persistence, and UI connections, with room to choose your own providers, framework, and infrastructure.

## Applications can grow without replacing the pieces

A travel-planning application might begin with a conversation and a tool that looks up places, then add voice or generate a structured itinerary for the rest of the application to use. As the product develops, those requirements become more specific, and the original conversation might become a relatively small part of the experience. You should be able to make those changes without replacing the tools and integrations you've already built.

The interface doesn't have to center on a conversation either. [Image and media generation](/blog/tanstack-ai-alpha-2) can live inside an editor, [realtime voice](/blog/tanstack-ai-realtime-voice-chat) can be the interface, and [structured output](/blog/streaming-structured-output) can feed the application you're already building. For a choice, a score, or a yes or no, [`decide()`](/ai/latest/docs/evaluate/evaluate) returns a typed result that your application can use directly.

This is the kind of flexibility I care about, the ability to change what you're building as you learn more about what it needs. That should hold whether you're writing the code yourself or working through those decisions with a coding agent.

## Agents can delegate work and use tools across applications

Since [the RC](/blog/tanstack-ai-rc), the team has added [named subagents](/ai/latest/docs/chat/subagents) to `chat()` and `useChat`, with typed inputs and limits. An assistant can delegate research and writing to separate agents, each with its own instructions, rather than handling every task in the same conversation.

[Portable Agent Skills](/ai/latest/docs/skills/agent-skills) let a tool-calling model load a `SKILL.md` when it needs the instructions, and [compaction](/ai/latest/docs/advanced/compaction) helps keep longer conversations within the context limit (using native provider compaction where it's available). For work that needs to interact with a page, [computer use](/ai/latest/docs/computer-use/computer-use) gives you a shared screenshot-based API for OpenAI and Anthropic.

The tools you build can also be used outside your application. With [`createMCPServer`](/ai/latest/docs/mcp/server), the TanStack tools you've already written can become an MCP server for Claude Desktop, Cursor, and other MCP hosts. MCP clients get tool filters, approvals, and task-based tools, and [WebMCP](/ai/latest/docs/tools/webmcp) lets browser agents call your client tools while your chat can use a page's tools.

A tool you've written for your own application can then be used from an MCP host without maintaining a separate implementation. That makes it possible to expose part of your product to other agents while continuing to use the same tools internally.

## Change models without starting the conversation over

Conversation history can replay across models, so trying another provider doesn't have to mean losing the conversation. You also get [`chat({ reasoning })`](/ai/latest/docs/chat/reasoning) with model-specific types, [automatic prompt caching](/ai/latest/docs/advanced/prompt-caching), and retries for rate-limited model calls.

You can [change tools and system prompts during a conversation](/ai/latest/docs/advanced/mid-conversation-changes) without unnecessarily losing the prompt cache, and use provider [Files APIs](/ai/latest/docs/advanced/files-api) through a common interface. Providers still have different capabilities, and the types reflect those differences so you can account for them while building the application.

The adapter lineup now includes Cloudflare Workers AI and AI Gateway, Lovable AI Gateway, Azure OpenAI, World Labs Marble, TypeSafe, and Ollaya, with `openaiCompatible` for OpenAI-style APIs. [Bring your own key](/ai/latest/docs/advanced/byok) support includes `defineByok` and keyed adapters. For local apps, there are also sign-in options for ChatGPT, GitHub Copilot, and OpenRouter, plus support for a Claude OAuth token.

The UI integrations cover React, Vue, Solid, Svelte, Preact, Angular, Octane, Remix, and vanilla JavaScript. [Remix 3 support](/ai/latest/docs/ui/remix) and Svelte devtools are recent additions, and the typed, headless chat UI factories give you a way to build [your own framework adapter](/ai/latest/docs/ui/custom-adapters). For work that needs a sandbox, the [provider options](/ai/latest/docs/sandbox/providers) now also include Blaxel, Upstash Box, E2B, boxd, and Railway.

The model, UI framework, and execution environment remain separate choices. You can choose the combination that fits your application rather than adopting all three together.

## An agent session that outlives the request

`chat()` handles a request, runs the model and its tools, and streams the result back. Longer-running agents need to retain more of that work between requests. A user might send another instruction during a turn, an approval might arrive after the page reloads, or a session might need to continue on another server.

The experimental [`@tanstack/ai-harness`](/ai/latest/docs/harness/overview) manages those longer-lived sessions. You define the harness with familiar `chat()` options, then open a session for each conversation.

```ts
import { createHarnessHost, defineHarness } from '@tanstack/ai-harness'
import { openaiText } from '@tanstack/ai-openai'
import { memoryPersistence } from '@tanstack/ai-persistence'

const assistant = defineHarness({
  name: 'acme/assistant',
  adapter: openaiText('gpt-6.1-sol'),
  systemPrompts: ['You are a helpful travel agent.'],
})

const host = createHarnessHost({ persistence: memoryPersistence() })
const session = await host.open(assistant, { threadId: 'trip-1' })

const plan = session.send('Plan a three-day trip to Lisbon.')
plan.onEvent('TEXT_MESSAGE_CONTENT', ({ event }) => {
  process.stdout.write(event.delta)
})

// The user types while the agent works. A steer joins the running turn.
await session.send('Keep it under 500 euros.', { mode: 'steer' })
await plan
```

The budget instruction joins the running turn before its next model call, or becomes the next turn if the current one has already finished. A follow-up waits for the current work to finish. Both use standard AG-UI events.

This example uses in-memory persistence; **recovery after a restart requires a durable store.** With that in place, sessions keep a log, interrupted turns can continue on the next host, and one host owns a thread at a time. Approvals, questions, and sign-in waits are recorded too, so another server can receive the answer after a restart. There are still [recovery limits](https://github.com/TanStack/ai/blob/main/docs/harness/deploy.md#known-limits), including in-memory child-agent waits that do not resume across hosts.

The harness also supports typed agents with budgets and timeouts, plugins that package tools and prompts with middleware and state, shared threads and access rules, per-user provider keys through `/connect`, and background work that can wait much longer than a single request.

Keeping session management separate from the agent definition lets you focus on its tools and behavior without implementing that coordination for each application.

### A coding agent built from the same APIs

A coding agent is one example of what these APIs can support. The first-party plugins include workspace tools, permissions, snapshots, todos, compaction, usage tracking, and project instructions, so you can assemble those pieces into your own agent and pass it to `runCli`.

```ts
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineHarness } from '@tanstack/ai-harness'
import {
  compact,
  permissions,
  todos,
  usage,
} from '@tanstack/ai-harness/plugins'
import { projectInstructions } from '@tanstack/ai-harness/plugins/node'
import { snapshots, workspaceTools } from '@tanstack/ai-harness/plugins/coding'
import { runCli } from '@tanstack/ai-harness-cli'
import { openaiText } from '@tanstack/ai-openai'

const root = process.cwd()

const coder = defineHarness({
  name: 'acme/coder',
  adapter: openaiText('gpt-6.1-sol'),
  systemPrompts: ['You are a careful coding agent. Read before you edit.'],
  plugins: () => [
    permissions({ root }),
    workspaceTools({ root }),
    snapshots({ root, dataDir: join(homedir(), '.acme-coder', 'snapshots') }),
    todos(),
    compact({ adapter: openaiText('gpt-6-luna') }),
    usage(),
    projectInstructions({ root }),
  ],
})

process.exitCode = await runCli(coder)
```

This agent has file tools, permission handling for risky calls, `/undo` for the last turn, a todo list, `/compact`, `/usage`, and project instructions. The permission plugin provides approval controls, not a sandbox; these tools run on the host with its permissions.

You can add [skills as slash commands](/ai/latest/docs/harness/skills), [`goal()`](/ai/latest/docs/harness/goal) to keep working until a judge model considers the goal met, [computer use](/ai/latest/docs/harness/computer-use), [Code Mode](/ai/latest/docs/harness/code-mode), or [MCP servers](/ai/latest/docs/harness/mcp). You can also [delegate coding work to Claude Code, Codex, Grok Build, or an ACP agent](/ai/latest/docs/harness/coding-agents), each in its own sandbox.

### One agent definition across terminal, web, and editors

The same harness can run in your terminal, in a script, behind an HTTP endpoint, or through an editor integration:

```bash
npx tsx coder.ts                            # chat in the terminal
npx tsx coder.ts -p "Fix the failing test"  # one prompt, for scripts and CI
npx tsx coder.ts --serve                    # the session protocol over HTTP
npx tsx coder.ts --acp                      # an ACP agent for editors such as Zed
npx tsx coder.ts --mcp                      # an MCP server for Claude Code and Cursor
```

`--acp` and `--mcp` load `@tanstack/ai-acp` and `@tanstack/ai-mcp` only when you use them.

In a web app, [`createHarnessHandler`](/ai/latest/docs/harness/connect) serves a session over HTTP, and `handleHarnessSocket` serves it over a WebSocket. The run route speaks standard AG-UI, so `useChat` works against a harness, with approvals and a page reload that joins the running turn.

`@tanstack/ai-harness` and `@tanstack/ai-harness-cli` remain on 0.x. The harness entry points in other packages, including `@tanstack/ai-skills/harness` and `@tanstack/ai-acp/agent`, are experimental too, and can change in a minor release.

That session model can support a standalone product, an internal tool, or a framework with its own conventions and defaults. The [first harness guide](/ai/latest/docs/harness/overview) and [coding agent guide](/ai/latest/docs/harness/coding-agent) have the full setup.

## Coding agents need current guidance too

If we're going to recommend telling a coding agent to use TanStack AI, it needs guidance for the APIs that are actually installed. The [Agent Skills for coding assistants](/ai/latest/docs/getting-started/agent-skills) provide that version-specific guidance, rather than relying entirely on examples in the model's training data.

The team also rewrote the hand-written docs for 1.0 around practical setups and the problems each API addresses. Adapter pages follow the same structure so you can compare them, and code-sample type checking in CI helps catch examples that drift away from the API.

For someone who hasn't programmed before, a coding agent can help write the application and work through the integration and setup. TanStack AI supplies the library APIs, while the application still needs the provider accounts, credentials, and hosting appropriate to what it's doing. The guidance helps the agent make those choices explicit as you build.

Our end-to-end tests run on every pull request, exercising provider adapters and tool execution flows against deterministic model fixtures. That lets us check the same scenarios across providers without live API calls.

For tests in your own application, [`fakeText()`](/ai/latest/docs/advanced/testing) lets you exercise `chat()`, tools, and middleware without a network connection or API key.

The [Quick Start](/ai/latest/docs/getting-started/quick-start) includes the initial setup for you or your coding agent to work from.

## Upgrading from 0.x

The stable release removes APIs that were already deprecated in 0.x, and their replacements were already available there. Applications that have already adopted those replacements will have fewer changes to make.

A 1.0 client needs a 1.0 server, so upgrade your stable packages together. The codemod handles common renames, and the [upgrade guide](/ai/latest/docs/migration/v1) covers the changes it can't make for you.

1. Run the codemod. It does the most common renames for you:

   ```bash
   npx jscodeshift \
     --parser=tsx \
     -t https://raw.githubusercontent.com/TanStack/ai/main/codemods/ag-ui-compliance/transform.ts \
     "src/**/*.{ts,tsx}"
   ```

2. Update your stable TanStack AI packages to 1.0 at the same time. The experimental harness packages stay on 0.x; do not try to upgrade them to 1.0. Remove `@tanstack/ai-react-ui`, `@tanstack/ai-solid-ui`, and `@tanstack/ai-vue-ui` if you use them. These three packages do not have 1.0 releases.
3. Run your type checker, and fix each error with the [upgrade guide](/ai/latest/docs/migration/v1).
4. If you keep data from 0.x (chats, runs, or files), do the saved-data steps in the guide before you deploy.

The main migration changes are below.

- `body` is now `forwardedProps`, and `conversationId` is now `threadId`. The codemod renames both.
- `threadId` is now required, in the browser and on the server. Neither side makes one for you. In the browser, pass a stable id for each conversation, such as the id from your route or your database. On the server, pass the id that the client sends:

  ```diff
    // In the browser
  - useChat({ connection })
  + useChat({ connection, threadId: chatId })

    // On the server
    const stream = chat({
      adapter: openaiText('gpt-6.1-sol'),
      messages: params.messages,
  -   conversationId: params.forwardedProps.conversationId,
  +   threadId: params.threadId,
    })
  ```

  The same goes for `ChatClient`, the generation hooks such as `useGenerateImage`, and the generation functions such as `generateImage()`. The codemod cannot add `threadId`, because it does not know your ids.

- `addToolApprovalResponse()` is gone. Resolve the `tool-approval` interrupt instead:

  ```diff
  - const { addToolApprovalResponse } = useChat({ connection, body: { userId } })
  - addToolApprovalResponse({ id, approved: true })
  + const { interrupts } = useChat({
  +   connection,
  +   threadId: chatId,
  +   forwardedProps: { userId },
  + })
  + const approval = interrupts.find((item) => item.kind === 'tool-approval')
  + if (approval?.kind === 'tool-approval') approval.resolveInterrupt(true)
  ```

- If you used `ai-react-ui`, `ai-solid-ui`, or `ai-vue-ui`, build your UI with `createChatHook` from `@tanstack/ai-react/ui`, `@tanstack/ai-solid/ui`, or `@tanstack/ai-vue/ui`.
- If you run your own server that streams to a TanStack AI client, stop sending `data: [DONE]`. End the run with a `RUN_FINISHED` event.

Passing the type check does not migrate stored conversations, runs, or files; those records need the saved-data migration as well.

## The work behind this release

[The alpha](/blog/tanstack-ai-alpha-your-ai-your-way) started in December 2025 with four providers, isomorphic tools, and devtools. [Alpha 2](/blog/tanstack-ai-alpha-2) added the other modalities, and the team kept refining the design, including [removing the `ai()` function](/blog/tanstack-ai-the-ai-function-postmortem) and [splitting the adapters](/blog/tanstack-ai-why-we-split-the-adapters) into smaller pieces.

Then came [middleware](/blog/tanstack-ai-middleware), [realtime voice](/blog/tanstack-ai-realtime-voice-chat), [Code Mode](/blog/tanstack-ai-code-mode), [streaming structured output](/blog/streaming-structured-output), and [AG-UI compliance](/blog/ag-ui-compliance). By [the beta](/blog/tanstack-ai-beta), we had [MCP](/blog/your-mcp-your-way) and [coding agents running in sandboxes](/blog/run-coding-agents-in-a-sandbox). TanStack AI was also named [AI Project of the Year](/blog/tanstack-open-source-awards-2026) at the Open Source Awards.

Alem, Jack, and Tom have taken TanStack AI a long way in less than a year, and I want to recognize the work behind the APIs as much as the APIs themselves. Adapters, documentation, tests, streaming, and persistence all need sustained attention as people use them in different applications. The team and contributors have put a substantial amount of work into those details.

Thank you to everyone who contributed code, filed an issue, put together a reproduction, answered a question in Discord, or showed the team something they'd built. That feedback helps the team understand where the APIs fit and where they still need work.

And thank you to our partners for supporting that work. [OpenRouter](/blog/openrouter-partnership) has supported TanStack AI from the beginning, and the support of all our partners helps us keep building these tools in the open.

<partner-list></partner-list>

Now that the core APIs are stable, the next work is polish and helping teams ship with them. Tell us where your application gets awkward, whether you're building a chat box, a voice agent, or a fleet of coding agents. We'll keep working on those rough edges, taking the harness to stable, and adding providers and sandboxes as the ecosystem grows.

## Build with TanStack AI 1.0

For React and OpenAI, install the core package and the two integrations:

```bash
pnpm add @tanstack/ai @tanstack/ai-react @tanstack/ai-openai
```

Choose the framework and provider packages appropriate to your application, then follow the [Quick Start](/ai/latest/docs/getting-started/quick-start). If you're already on 0.x, use the [upgrade guide](/ai/latest/docs/migration/v1).

Take an AI experience you want to build, describe how it should work, and ask your coding agent to implement it with TanStack AI. Start with a real requirement, then extend it as you learn what the application needs. That's where I want these APIs to prove themselves, in the range of things people can build with them.

[Show us what you build](https://tlinz.com/discord).

Have fun building.
