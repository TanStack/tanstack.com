---
title: TanStack Has a New Look
published: 2026-07-15
excerpt: TanStack has a new logo, a design system, and a brand that finally looks like actual people care about the details, because we do.
authors:
  - Tanner Linsley
---

TanStack has a new look, and it's kind of wild that we made it this far with design that was mostly just good enough.

![New TanStack logo variant swatches](/blog-assets/tanstack-has-a-new-look/logo-swatch.svg)

We've never had paid marketing, big outreach campaigns, paid DevRel, or a team whose job was to make the brand feel bigger than it was, and almost everything we've put into the world has come from the open source side of the house, maintainers building the thing, explaining the thing, maybe making a fun page when someone had a little extra energy, then going right back to the software, the docs, the community, and the reliability.

That's humbling. Developers trusted the tools enough to overlook the places where the design lagged behind them, and I don't take that for granted.

A lot of people on this team are good designers, honestly, but it's not what we're paid to do all day and most of us don't want it pulling us away from the work we're already responsible for. I could drop everything and spend three months on TanStack design and probably get it somewhere good, but the tools, docs, APIs, issues, examples, and community would pay for it, because those hours have to come from somewhere.

That's why having Andy Beutler as TanStack's first lead designer matters so much. We've never had somebody whose full-time job was to stay with these problems, and for years the "design system" was basically engineering taste, maintainer instinct, a pile of Tailwind classes, and whatever consistency we could remember while also shipping libraries, docs, examples, sponsors, merch, and a thousand other things.

It worked better than it probably should have, but it was starting to crack, and Andy can focus on this in a way the rest of us couldn't without pulling away from the libraries, docs, and community. He's taken a lot of taste that used to live in a bunch of people's heads and turned it into a new logo system, global type, design tokens, `/ds`, a component kit, Phosphor icons, and yes, a little palm loader that makes me happier than a loader probably should.

Our old brand wasn't bad. It was clean, organized, and mostly did the design things you're supposed to do, the colors were consistent, the spacing was consistent, the pages were tidy enough, the boxes lined up, and for a long time that was the bar. If a software site looked clean and organized and vaguely developer-y, you could call it done and nobody would really push back.

I don't think that's enough anymore, because AI made that version of polish cheap. You can ask a model to make a clean developer homepage and it'll give you something that checks a surprising number of boxes, maybe not perfect, maybe not production-ready, but close enough that the old signals don't mean what they used to mean, and that's been bothering me more than I expected.

TanStack is also in a weird and important spot right now. We're building tools for the future of AI, whether that's agents reading docs, models calling typed tools, software writing software, or developers handing off more and more work to systems that need APIs and state and errors to be extremely clear. A lot of what we're building has to be good for machines, but I really, really don't want TanStack to feel machine-made.

These libraries come from real people who have lived these problems for years, and we know why server state gets messy because we've been in the app at midnight trying to figure out why the UI is lying. We know why routing is hard because we've watched apps slowly turn into piles of special cases, and we know why tables and forms and databases and AI workflows can eat your whole life if the primitives underneath them are wrong.

The whole point of TanStack has always been to give some of that life back. If TanStack Query makes you stop worrying about a class of bugs, that's time back. If Router gives you a route tree you can trust, that's time back. If Table or Form keeps you from rebuilding the same pile of state management for the tenth time, that's time back. If Start or DB or AI can remove some of the machinery that usually sits between you and the product you're trying to ship, that's time back.

And time back is the real product, at least to me.

The beach thing stuck around because of that. The palm tree, the island, the relaxed vibe, all of it can look kind of silly from the outside if you reduce it to a mascot or a decoration, but for me it has always been the easiest visual way to say "you're in good hands, go enjoy your life." Go outside, go be with your family, go cook something, go sit in the shade, go touch sand if touching grass isn't beachy enough, your software should not need you hovering over it forever.

I want TanStack to earn that feeling.

The old brand pointed at that idea, but it didn't really carry it. It looked like a clean developer site with some beach energy layered on top, and it didn't look as cared for as it actually was. It felt too easy to reproduce, which in 2026 is a real problem.

The new brand doesn't turn TanStack into some over-designed art project, because I don't want that either. I don't want a site that screams "look how designed this is," I want it to feel careful, warm, a little imperfect in the places where perfection would make it feel fake, restrained in the places where AI would let us do literally anything, more like someone chose a few things on purpose and then had the discipline to stop.

AI makes it feel like you can do everything, all the time, instantly, more gradients, more motion, more variations, more generated texture, more content, more pages, more everything, but I think the bar for human quality is going the other direction, knowing what to refuse, choosing the thing that matters and doing it with enough attention that people can feel the difference, even if they can't explain every choice.

That's how I want the tools to feel too, opinionated enough that you're not rebuilding the same decisions, boring where boring means dependable, and open enough for real apps to escape when they need to.

The design system itself lives at [/ds](/ds), and that's probably the part of this launch I'm most excited to keep building on because it turns all of this into something shareable. Colors have primitive ramps and semantic tokens now, type has roles instead of vibes, components have one home, and that sounds boring until you've maintained a site for years and had to make the same decision fifty different ways.

![TanStack design system snapshot](/blog-assets/tanstack-has-a-new-look/design-system-snapshot.svg)

I'm excited because we finally have something to make decisions against. When a page feels off, we can say why, when a component needs to exist, it has somewhere to live, and when the site starts drifting, we have something shared to bring it back to.

This isn't finished. Some pages still need work, some things still feel halfway between the old world and the new one, and that's okay. I'd rather have a real foundation and keep moving than pretend a rebrand is one magical day where everything becomes perfect.

We can build for AI and still make things that feel like people cared, because the reason any of this matters is that people want to build something and then go live their actual lives. That's what I want the brand to say now, you're in good hands, we care about the details, and if we do our job right, you can stop worrying about the software for a bit and go be a person.
