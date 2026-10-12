---
title: TanStack Start 1.0
published: 2026-10-10
draft: true
excerpt: TanStack Start 1.0 is stable and ready for production.
authors:
  - Tanner Linsley
library: start
---

# TanStack Start 1.0

TanStack Start 1.0 is finally stable. And we're really excited to officially call it ready for production.

I can't begin to say how proud I am of what we've built here and of the people who have built it. And I'm also really, really looking forward to not needing to remind everybody who's already using it in production that it's still a release candidate (that conversation has happened a lot more than you'd think).

We've had tons of people put Start into production through pretty much every stage of its development, from small projects and startups to entire enterprise teams and Fortune 500 companies. To our surprise, so many of these companies insisted on using it even when it was in beta. We'd explain where things were, and they'd basically tell us we're going to use it anyway.

When enterprise teams are insisting on putting your beta software into production before it's even a release candidate, it's difficult to not feel the massive level of trust everybody is putting in you. So even though people have been successfully using Start in production for a long time, this is us making our formal commitment to the APIs we've built and the people building on them. You can now choose Start, learn it, ship something with it, and continue to build without wondering whether we're going to change the entire way your application works.

<!-- Before publication: specify the exact stable API surface, experimental features, versioning policy, and RC upgrade path. Confirm RSC and framework/build-adapter status individually. -->

Sure, getting here took longer than I thought it would. If you read our RC announcement, we were expecting a pretty short stretch of polish, and looking back through what actually landed after that, calling all of it polish would be underselling a lot of people's work.

## Start started with a router

Oddly enough, Start is not where this journey actually started (no pun intended). I was trying to build the router I wanted to use, and I wanted my routes to know which paths existed, which parameters they needed, which search parameters were valid and what they looked like, what loader data returned, and even what context was available all through the route tree. I wanted to know that when I changed something, my editor could tell me exactly what else needed to change and catch the type errors that came with it.

That sounds pretty reasonable now, but you've got to remember that there was a ton of skepticism around that entire idea. Back when I was writing Router, or even just researching it, a lot of people didn't think that level of type safety was possible. Some didn't even think it mattered, and there were a few who thought it was just way too much work for a router. To be honest, a few years earlier I would've agreed with them.

Believe it or not, I used to think TypeScript was unnecessary, mostly extra work. I already knew what my code did, so why did I need to explain it to something else? Working on React Query over the years and learning from people who helped move it to TypeScript changed that for me entirely. Eventually I started seeing types as something that I could and should design with, something that could make an API easier to use in the first place. And once all that clicked, it was really difficult to stop noticing all these places where we were asking developers to remember things that tools should just already know.

Building a router around TypeScript was a massive investment, I was betting on something people were telling me wasn't important or wasn't possible, and I didn't even know yet that I was also building the foundation for a full-stack framework, on principles that would help us in the age of AI too.

By around December 2023, there was already work in the repo on server utilities that would become the very first beginnings of Start. Then by May 2024, I made a commit where I renamed the `react-router-server` package to `start`, complete with a goofy emoji, which is the very official framework naming process.

## I wanted another option

It was around that time I felt like the React ecosystem was really constraining its idea of what an application should look like. Next.js was making a very big bet on React Server Components, as a framework primitive and an ideology, and moving more and more toward a server-oriented model. React Router and Remix were working through their own changes. There were interesting ideas in all of this, but I wasn't really comfortable with how the conversation seemed to land on one answer for everybody.

I wanted to keep building the kinds of apps I already knew how to build, the same kinds of apps I'd been building for the last ten years. State management, client-side navigation, data caching, and in my opinion, all the things that have made SPA development the most productive way to work. But I also wanted all the new things. I wanted server rendering, streaming, server functions, the ability to just put work on the server when I knew that was the right place for it, without having to change everything about the way my app worked. I didn't want adding any of those things to mean relearning an entire application framework and structure.

That's honestly still what I love about using Start. It feels familiar. My components are components, my routes are routes, and when I need the server, I have a very direct and explicit way to use it. There's a lot happening under the hood to make that easy, but we don't want you to have to keep a second explanation of your app in your head just to get through the day. Simple doesn't have to mean bare bones, I like conveniences and powerful APIs, I want the common thing to be as easy as possible without running out of useful tools when things get complicated (which they probably will, as most apps do).

With Start, a route can render on the server, load its data there without rendering the component, or render on the client. You can call a typed server function from a loader or an event handler and compose middleware around those calls, including work on the client and the server. It's full-stack middleware that can cross the client and server, with types carrying the context through. These choices fit into the same application model that so many of us have worked with over the last decade, and that so many companies have worked hard to adopt. You get to decide where work truly belongs without giving up the routing and data tools the ecosystem has grown to love, or the architecture that a ton of the interactive web has been built on.

Start definitely wasn't the first framework to have a lot of these ideas. Many are borrowed from other frameworks we've used, and I've tried a lot of them. React Router has great primitive design, SolidJS has been a massive inspiration on full-stack APIs and performance, and Next.js really knows how to explain and market an idea to the masses. I've disagreed with the direction of many projects over the years, sometimes pretty loudly, but just as they used the work that came before them for inspiration, so did we.

## Choosing where the code runs

One small example of what I mean by explicit APIs is `createIsomorphicFn`. Say you need the current origin to build an absolute URL. On the server that comes from the incoming request, in the browser it comes from `window.location`, and you can put those two implementations right next to each other.

```tsx
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const getOrigin = createIsomorphicFn()
  .server(() => new URL(getRequest().url).origin)
  .client(() => window.location.origin)

// Call during a server request or in the browser.
const absoluteUrl = new URL('/about', getOrigin()).href
```

That's a simplified version of something we use on this website for social image URLs. The call stays the same, the implementation depends on where it's running, and Start removes the other environment's implementation from that bundle. Calling it in the browser doesn't make a request back to the server. When you do want a server call, that's what `createServerFn` is for.

The [environment functions guide](https://tanstack.com/start/latest/docs/framework/react/guide/environment-functions) goes into the details. This is the kind of control I want when building an app, I can see where each piece runs without changing the rest of my code around it.

## Other people made it much better

Manuel and Flo took this so much further than I could've taken it on my own. I knew what I wanted Start to feel like to use, but that doesn't necessarily mean I knew how to build every single part of it. There are things in the framework today that are better than what I even knew to ask for. So when I look back at how long this took, I also look at what actually got committed, the compiler work, streaming, server boundaries, hydration, all the combinations people found by putting it into real apps, and how much of that came from people other than me.

The [SSR performance work](https://tanstack.com/blog/tanstack-start-5x-ssr-throughput) Manuel and Flo did is one of my favorite examples. They profiled what the server was doing and kept finding work it didn't need to do, eventually getting roughly five and a half times the throughput in their benchmark.

And there's so much work that you can't fit into this announcement around regression tests, benchmarks, allocations we don't need anymore, or compiler bugs caught before they reach somebody's app. That's stuff I'm not sure I would've had the attention or the time to invest in. People say the last ten percent takes the longest and is the hardest, and that's definitely true here, I wouldn't have gotten through that last ten percent without Manuel and Flo. So much of the trust people can put in this framework comes down to the work those guys did.

## Freedom takes work

I've spent years on framework agnosticism across TanStack, well before Start, because I don't want all the useful work you build into a library to have to be rewritten or go by the wayside whenever a new UI framework happens to be popular. I want to treat those other frameworks as real options, which means actually designing for them and finding out where we've made assumptions. Supporting Solid will teach you pretty quickly which parts of your supposedly agnostic code are still thinking in React. We went through something similar [adding Rsbuild support](https://tanstack.com/blog/start-adds-rsbuild-support), with assumptions about the build tool that had worked their way into the core of the framework. Being able to make those choices now is pretty freaking awesome.

<!-- Before publication: verify the Vinxi/Nitro/Vite transition dates and distinguish their roles before adding the spoken build-tool history. Rsbuild support does not establish support for every bundler. -->

Hosting has been its own crazy adventure. At one point I was pretty discouraged looking at all the deployment adapters we'd have to maintain. I remember Ryan Carniato's advice was basically to use Vite and Nitro, and that helped us [change direction early on](https://tanstack.com/blog/why-tanstack-start-is-ditching-adapters). I'm really glad we listened, I wanted to spend our time making Start better instead of rebuilding deployment adapters and maintaining them for eternity. I wanted people to be able to choose where to run it without having that choice take over how they build their application. And even though we support Rsbuild too, my hat's off to Vite for the work they've done to make that separation possible.

## Yes, we spent a lot of time on RSC

For a while, supporting React Server Components felt like this box we had to check to be taken seriously as a React framework, and I'm not going to lie, that's pretty frustrating. I think a lot of that came from the marketing around RSC, both from Next.js and from the React team themselves. It was propped up as the answer to so many things in the React ecosystem, and in my opinion it got a little too much fuel behind it for the distance you could actually get out of it. Regardless, we decided to spend time on it. A lot of time. And some really good work came out of that, Manuel in particular put a huge amount of work into figuring out how RSC could fit into Start without taking ownership of the entire application model.

We wrote about [our approach](https://tanstack.com/blog/react-server-components) and [who owns the component tree](https://tanstack.com/blog/who-owns-the-tree), because after understanding how RSC fits into something that isn't Next.js, the questions around composition and which side owns the tree mattered a lot more than checking a feature off in a comparison table. I'm happy we could build that integration without changing Start's underlying application model or making its core depend on React.

<!-- Before publication: verify and add Jacob Ebey's related React Router work and confirm the exact release/experimental status of Start's RSC integration. -->

At the same time, I've been disappointed with parts of the experience of using RSC. I was really excited to use it on tanstack.com, I knew we could get value out of keeping logic on the server instead of shipping it to the client. But understanding exactly what we were shipping where became this long, arduous process, and I could see the fingerprints of RSC throughout our codebase making things more complicated to reason about than I wanted, for us and for our AI models. Ultimately I decided to [stop using it on tanstack.com](https://tanstack.com/blog/we-stopped-using-rsc-on-tanstack-com). Which is funny, because changes to how we did Markdown and highlighting were enough to make the tradeoff favor removing it.

AI has changed how I approach that work too, including being able to build Markdown and highlighting libraries that do exactly what we need on the front end, instead of having to work around the cost of shipping other libraries to the client. I'm glad we went through that process, and taking RSC out didn't mean rewriting our application. We could choose to put it back if our needs changed again. That's the kind of freedom I wanted, even something as complex and unique as RSC could be something we opted into and out of without it deciding how the rest of our app had to work.

## Then agents showed up

I'm pretty sure it was around November of 2025 when AI started noticeably changing how we worked on Start, and by early 2026 it felt like we were dealing with it everywhere. We'd begun using it to look for performance improvements and security issues, and the volume of pull requests and issues coming into Start and Router started to skyrocket. A lot of it was drive-by stuff, generated content somebody hadn't really read or understood before sending it to us, and honestly that's frustrating because it takes so much time away from the people doing the work. I'd be sugarcoating it to say we've figured out how to manage all of that. There are still a lot of problems to work through, we're doing our best to mitigate them, and I am optimistic that it's going to get better and easier.

<!-- Timeline note: this reading places widespread impact in early 2026; earlier recollections said mid-2026. Confirm against repository activity if using a precise timeline. -->

Security changed really early on. People are using AI to actively look for vulnerabilities, and we're using it ourselves and with our partners to find and fix problems proactively. It's surprising how quickly that became a normal part of open source maintenance, but it has to be at this point, and I'm really grateful to our partners for helping us with it. Security is never done. I'm sure we'll have our share of security adventures in the future, but knowing the team and our partners keep working on it, with and without AI, gives me a lot of confidence in how we'll handle them.

Beyond security, we've all been using agents to build and watching other people use them to build with Start, and so much of it brings me back to Router. All the work we did to make it type-safe and strict, and to make the APIs explicit, was about giving you as much freedom as possible while still being able to tell you when something isn't right or doesn't fit. We originally did that for people. I wanted you to be able to move things around in your editor and try things and have your editor help you, without remembering every connection in your application.

An agent needs a lot of that same help, you can ask for almost anything, and it'll go change a route parameter or the input to a server function, and then it needs help finding the places that no longer agree with that change.

Models are great and they're getting better. Maybe someday TypeScript won't be necessary for that feedback, but for now, with the size of applications people are building on Start, the more complicated they get, the more agents benefit from it. The types can't tell you whether you've built the right thing, you still have to do that part, but they can help keep the changes sane.

We didn't have to redesign Router or Start around agents to get there, the design for type safety and explicitness was absolutely deliberate. The timing with agentic development was a happy coincidence, but I'm not going to say we just got extremely lucky, these were problems worth worrying about before AI. Humans and agents run into a lot of the same problems, just on a different scale.

Type safety can't solve everything, though. We did have to teach agents how to use Start and Router. Sarah Gerrard and Kyle Mathews helped bring [TanStack Intent](https://tanstack.com/blog/from-docs-to-agents) into the picture, and we made a massive push across TanStack to get guidance in the form of skills right into our npm packages, with a lot of it anchored around Start and Router. Knowing an API exists and knowing the best practices around it are very different things, and that's something I don't want to rely on training data for. Now we also have [tools for maintaining those skills](https://tanstack.com/blog/intent-0.5-skills-you-can-maintain), checking the examples and keeping that guidance connected to changes in the code. I think there's a lot more we can do to give agents assurances about what they're building, but we'll leave that for another day.

## People started betting on it

There have been so many companies and partners willing to take a chance on Start early on. Convex supported it when it was extremely early, and I'm really grateful for that. Vercel took an early bet on us too and was part of the support that helped me go full-time on TanStack, and I'm really happy to have them back as a partner. AG Grid has been supporting our work for years. Clerk had a Start SDK in beta back in 2024, Netlify helped fund development and worked with us on deployment, and Cloudflare has been a massive part of making Start work well on Workers.

<!-- Before publication: establish the chronological order of all historical partner mentions from verified dates. This paragraph is provisional, not a verified timeline. Reconcile the spoken Vercel 2027 reference with the existing roster. Verify partner app/site migrations, Railway's migration scope, and Netlify's Start-based agent builder before adding those claims. -->

Lovable really surprised me, though. When I heard they were going to use Start for the applications their product generates, that was a very different conversation from somebody trying it on a side project. They were choosing Start as the foundation for things other people were going to build, a lot of other people. [Lovable started generating new projects with Start in May 2026](https://lovable.dev/blog/building-apps-using-tanstack-start), and their explanation connects so much of what we've been working toward, server rendering, portability, type safety, the things that help generated code fit together. Their trust has been a significant part of helping Start become what it is today.

And there's so much work around the framework that makes it possible for people to actually choose it. WorkOS and Clerk help us understand how to make Start work well with authentication without building our own authentication. CodeRabbit helps review work in the repo, Railway and Render help people ship their applications, Sentry has a dedicated SDK, and Prisma has put work into getting people started with their data layer. People have built integrations, published examples, added deployment support, and chosen Start for their own applications, and I'm grateful for all of it.

<!-- Before publication: check the specific contributions and chronology against the complete current partner roster so nobody involved with Start is omitted. Keep historical prose chronological; keep the logo grids tiered and deterministically randomized. -->

## Come build something

If you've been waiting for 1.0, we really want you to give Start a try. The [documentation](https://tanstack.com/start/latest/docs/framework/react/overview) is a great place to start, and if you're moving an existing application, we have [migration guidance](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js). But honestly, I'd put an agent to work on it with you. In my experience they've become amazingly good at working through both new projects and migrations, especially when they have current guidance, TypeScript, and tests to check the changes. Try telling your agent to “use TanStack Start,” you'd be surprised how far that can get you.

I want to officially and publicly thank Manuel Schiller, Florian Pellet, Brenley Dueck, Birk Skyum, Sean Cassiere, the wider maintainer team, and everybody whose work shows up in the foundation of Start. I also want to thank Jack Herrington, Sarah Gerrard, Kyle Mathews, and Ryan Carniato for the ideas, tooling, explanations, and constant advice that helped us get here.

And to everybody who wrote a reproduction, answered somebody's question, made a tutorial, improved the docs, or patiently helped us understand what broke in their application, thank you so much. There's tons of that work in this release, and most of it doesn't come with a name attached to a big feature. We owe so much of the polish and quality to that consistent stream of little things and the people who keep giving their support.

A big thank you to all of our current partners for helping make this work possible.

<partner-list></partner-list>

And thank you to our previous partners and sponsors for helping us get Start to this point.

<previous-partner-list></previous-partner-list>

<!-- Before publication: review acknowledgements with the team for omissions and preferred names; refresh the partner roster. -->

I started this because I wanted a better way to build my own apps and I didn't want to compromise. Somewhere along the way, a whole lot of other people decided they wanted to help build it with me and turned it into something bigger and better than I could've done on my own. And now I'm excited to see what you can build with it.

Happy building.
