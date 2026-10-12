---
title: TanStack Start 1.0
published: 2026-10-10
draft: true
excerpt: TanStack Start 1.0 is finally here, and this is the story of how we got here.
authors:
  - Tanner Linsley
library: start
---

# TanStack Start 1.0

TanStack Start 1.0 is finally here! And we're beyond excited to officially call it stable and ready for production.

I'm so proud of what we've built and the people who helped build it, and I'm very ready to stop having the conversation where somebody tells me they're running their entire business on Start and I have to remind them it's still a release candidate (that conversation has happened a lot more than I expected). We've had people put Start into production through pretty much every stage of its development, from small projects and startups to enterprise teams and Fortune 500 companies, and some of them were insisting on using it before we even got to RC. We'd explain where things were, and they'd basically tell us, yeah, we understand, we're using it anyway. And when enterprise teams are insisting on putting it into production before you've even called it a release candidate, you start realizing that a lot of what you're still working toward is making the commitment official, settling the APIs and making sure you're ready to support the people who've already put that much trust in you.

For me, 1.0 is us making a commitment to the APIs we've built and the people building on them. You should be able to choose Start, learn it, ship something with it, and keep building without wondering whether we're about to change the whole way your application works.

<!-- Before publication: specify the exact stable API surface, experimental features, versioning policy, and RC upgrade path. This is a central part of the announcement, not a footnote. Confirm RSC and framework/build-adapter status individually. -->

Getting here took longer than I thought it would (if you read our RC announcement, I was expecting a pretty short stretch of polish), and looking back through what actually landed after that, calling all of it polish would be underselling a lot of people's work.

## Start started with a router

Start wasn't actually where this started, I was trying to build the router I wanted to use, and I wanted my routes to know which paths existed, which parameters they needed, what my search parameters looked like, what data a loader returned, and what context was available further down the route tree, so when I changed something, my editor could tell me what else needed to change. That sounds pretty reasonable now, but there was a lot of skepticism around it. Some people didn't think that level of type safety was possible, some didn't think it mattered, and some thought it was an awful lot of work for a router (and a few years earlier, I probably would have agreed with them).

I used to think TypeScript was mostly extra work. I already knew what my code did, why did I need to explain it to something else? Working on React Query, and learning from the people helping move it to TypeScript, changed that for me. Eventually I started seeing types as something I could design with, something that could make an API easier to use in the first place, and once that clicked, it was hard to stop noticing all the places where we were asking developers to remember things the tools could already know. Building a router around that was a pretty big investment, I was betting on something people were telling me wasn't important or wasn't even possible, and I didn't know yet that I was also building the foundation for a full-stack framework.

By December 2023, there's already work in the repo on the server utilities that would become part of Start, and in May 2024, there's a commit where I renamed `react-router-server` to `start`, complete with a goofy emoji (very official framework naming process).

## I wanted another option

Around that time, I felt like the React ecosystem was narrowing its idea of what an application should look like, Next was making a very big bet on React Server Components and a more server-oriented model, React Router and Remix were working through their own changes, and there were interesting ideas in all of it, but I wasn't comfortable with how often the conversation seemed to land on one answer for everybody.

I wanted to keep building the kinds of applications I already knew how to build, with state, client-side navigation, data caches, and all the things that have made SPA development such a productive way to work, and I also wanted server rendering, streaming, server functions, and the ability to put work on the server when that was the right place for it, and I didn't want adding those things to mean relearning my entire application.

That's still what I love about using Start, it feels familiar, your components are components, your routes are routes, and when you need the server, you have a pretty direct way to use it. There's a lot happening to make that easy, but I don't want you to have to keep a second explanation of your application in your head just to get through the day. And simple doesn't have to mean bare bones, I like conveniences and powerful APIs, and I want the common thing to be easy without running out of useful tools when your application gets complicated (which it probably will).

A route can render normally on the server, load its data there without rendering its component, or render on the client. You can call a typed server function from a loader or an event handler. You can compose middleware around those calls, including work on the client and work on the server, with types carrying the context through, and those choices fit into the same application model, so you get to decide where the work belongs without giving up the routing and data tools you already understand.

I've borrowed ideas from pretty much every framework I've used (and I've tried a lot of them). React Router has done great work on primitives, Solid has been a huge inspiration on performance, and Next knows how to explain and market an idea. I've disagreed with directions those projects have taken, sometimes pretty loudly, but there's a lot of good work there that has influenced mine.

## Other people made it much better

Manuel and Flo took this so much further than I could have taken it on my own. I knew what I wanted Start to feel like to use, but that doesn't mean I knew how to build every part of it, and there are things in the framework today that are better than what I even knew to ask for. So when I look back at how long this took, I also look at what actually landed, the compiler work, streaming, server boundaries, hydration, all the combinations people found by putting it in real applications, and how much of that came from people other than me.

The [SSR performance work](https://tanstack.com/blog/tanstack-start-5x-ssr-throughput) Manuel and Flo did is one of my favorite examples. They profiled what the server was doing and kept finding work it didn't need to do, eventually getting roughly 5.5x the throughput in their benchmark. That's their benchmark, your application is going to have its own workload, but I love that we got there by going back through the implementation and understanding it better. There's a lot more of that work in this release than you can fit into an announcement, regression tests, benchmarks, allocations we don't need anymore, compiler bugs caught before they reach somebody's app. Those are things I want us spending time on when people are trusting us with their framework.

## Freedom takes work

I've spent years on framework agnosticism across TanStack, well before Start, because I don't want all the useful work in a library to come and go with whatever UI framework happens to be popular around it. And I want to treat those other frameworks as real options, which means actually designing for them and finding out where we've made assumptions. Supporting Solid will teach you pretty quickly which parts of your supposedly agnostic code are still thinking in React. We went through something similar [adding Rsbuild](https://tanstack.com/blog/start-adds-rsbuild-support), with assumptions about the build tool that had worked their way into the framework.

Hosting has been its own adventure. At one point I was pretty discouraged looking at the deployment adapters we'd have to maintain, and Ryan Carniato's advice was basically to use Vite and Nitro. That helped us [change direction](https://tanstack.com/blog/why-tanstack-start-is-ditching-adapters), and I'm glad we listened, I want us spending our time making Start better, and I want you to be able to choose where you run it without that choice taking over how you build your app.

## Yes, we spent a lot of time on RSC

For a while, supporting React Server Components felt like a box we had to check to be taken seriously as a React framework. We spent a lot of time on it, and some really good work came out of that. Manuel in particular put a huge amount into figuring out how RSC could fit into Start without taking ownership of the entire application model. We wrote about [that approach](https://tanstack.com/blog/react-server-components), and about [who owns the component tree](https://tanstack.com/blog/who-owns-the-tree), because those decisions matter beyond whether a feature appears in a comparison table.

We also used RSC on tanstack.com, got real value out of it, and then [stopped using it](https://tanstack.com/blog/we-stopped-using-rsc-on-tanstack-com) when changes to our Markdown and highlighting code made the tradeoff different. I'm glad we could do that, we learned something, our needs changed, and we changed the implementation, which is the kind of freedom I want you to have with your own application, too.

## Then agents showed up

I think it was around November of 2025 when AI started noticeably changing the work around Start, and by the middle of 2026 we were dealing with it everywhere. The volume of PRs and issues went up, a lot of it was drive-by stuff, generated content that someone hadn't really read or understood before sending it to us, and that takes time away from the people actually doing the work. Security has changed along with it. People are using AI to actively look for vulnerabilities, we're using it ourselves and with partners to find and fix problems, and that's becoming a normal part of maintaining this thing. It has to be.

But I've also been using agents to build, and watching other people use them to build with Start, and I keep coming back to the router. All that work to make the types strict, to make the APIs explicit, to give you as much freedom as possible while still being able to tell you when something doesn't fit, we did that for people. I wanted you to be able to move things around and try things and have your editor help you, without having to remember every connection in your application. An agent needs a lot of that same help, it changes a route parameter or the input to a server function and now it can find the places that no longer agree with it, and the more complicated the application gets, the more I want that feedback. It doesn't tell you whether you've built the right thing, you still have to do that part, but it gives you a way to keep making changes without guessing about all of those connections. We didn't have to redesign Router and Start around agents to get there (the design was deliberate, having it line up this well with how people are building now was a pretty happy coincidence).

We did have a lot to teach them, though. Sarah Gerrard and Kyle Mathews helped bring [TanStack Intent](https://tanstack.com/blog/from-docs-to-agents) into the picture, and we made a big push across TanStack to get that guidance into the packages, with a lot of it anchored around how agents use Start and Router. I'm glad we invested in that too, because knowing an API exists and knowing how to use it well in somebody's application are different things. And now we have [tools for maintaining those skills](https://tanstack.com/blog/intent-0.5-skills-you-can-maintain), checking the examples and keeping the guidance connected to the code as it changes.

## People started betting on it

Lovable really surprised us. They were going to use Start for the applications their product generates, which is a very different conversation from somebody trying it on a side project, because you're choosing a foundation for things other people are going to build (including things you haven't seen yet). [Lovable began generating new projects with Start in May 2026](https://lovable.dev/blog/building-apps-using-tanstack-start), and their explanation connects a lot of what we've been working toward: server rendering, portability, and types that help generated code fit together.

They weren't the first to take a chance on us. Convex supported Start when it was extremely early, and I'm still grateful for that. Vercel also supported us early on, and I'm really glad to have them back as a partner after some time away (that early support still means a lot to me). Clerk had a Start SDK in beta back in 2024. Netlify helped fund development and worked with us on deployment, and Cloudflare has been an important part of making Start work well on Workers.

Since then we've seen people build integrations, publish examples, add deployment support, and choose Start for their own applications. WorkOS and Clerk help people bring authentication into their apps, Sentry has a dedicated SDK, and companies like Railway, Render, Vercel, and Cloudflare give people places to run what they build. Prisma has put work into getting people started with their data layer.

## Come build something

If you've been waiting for 1.0, I'd love for you to give Start a try. Start with the [docs](https://tanstack.com/start/latest/docs/framework/react/overview). If you're moving an existing application, we have [migration guidance](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), and I would absolutely put an agent to work with you on that. In my experience, agents have become a really good way to work through a migration, especially when they have the current guidance and can use the types and tests to check the changes.

I also want to thank Manuel Schiller and Florian Pellet, Brenley Dueck, Birk Skyum, Sean Cassiere, and the wider maintainer team, along with people like TkDodo and Edmund Hung, whose contributions show up in the foundations of this work. And thank you to Jack Herrington, Sarah Gerrard, Kyle Mathews, and Ryan Carniato for the ideas, tooling, explanations, and advice that helped us get here. And to everyone who wrote a reproduction, answered somebody's question, made a tutorial, improved the docs, or patiently helped us understand what broke in their application, thank you, there's so much of that work in this release and most of it doesn't come with a name attached to a big feature.

Thank you to our current partners for helping make this work possible.

<partner-list></partner-list>

And to our previous partners and sponsors, you're part of this history too (support doesn't stop mattering when a sponsorship ends).

<previous-partner-list></previous-partner-list>

<!-- Before publication: review acknowledgements with the team for omissions and preferred names; refresh the partner roster. Add verified named migration stories if available. -->

I started this because I wanted a better way to build my own applications, and somewhere along the way, a whole lot of other people decided they wanted to help build it with me, and they turned it into something much better than I could have made on my own. I'm so excited to see what you build with it.
