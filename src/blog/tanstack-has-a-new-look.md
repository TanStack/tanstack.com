---
title: TanStack Has a New Look
published: 2026-07-15
excerpt: TanStack is getting a new logo, a real design system, and a brand that feels a lot closer to what I've always wanted the tools to feel like, calm, human, careful, and good enough to stop worrying about.
authors:
  - Tanner Linsley
---

TanStack is getting a new look this week, probably July 15 if everything lands where it's supposed to.

A small preview of where it's headed:

![New TanStack logo variant swatches](/blog-assets/tanstack-has-a-new-look/logo-swatch.svg)

It's kind of wild that TanStack made it this far with design that was mostly just good enough. We've never had paid marketing, big outreach campaigns, paid DevRel, or a team whose job was to make the brand feel bigger than it was, and almost everything we've put into the world has come from the open source side of the house, maintainers building the thing, explaining the thing, maybe making a fun page when someone had a little extra energy, then going right back to the software, the docs, the community, and the reliability.

That's humbling, because developers have trusted us enough on the quality of the tools to forgive design that sometimes lagged behind the product, and I don't take that as proof design doesn't matter, I take it as proof that trust is expensive and we've been spending it carefully.

I also don't think any of this says our team isn't good at design. A lot of us are, honestly, it's just not what we're paid to do every day, and most of us don't want design to be the thing that pulls us away from the product for weeks at a time. If I dropped everything and did TanStack design full-time, I think we'd get somewhere good, but the tools, docs, APIs, issues, examples, and community would end up paying for it.

Our current brand isn't bad either. It's clean, it's organized, it mostly does the design things you're supposed to do, the colors are consistent, the spacing is consistent, the pages are tidy enough, the boxes line up, and for a long time that was the bar. If a software site looked clean and organized and vaguely developer-y, you could call it done and nobody would really push back.

I don't think that's enough anymore, because AI made that version of polish cheap. You can ask a model to make a clean developer homepage and it'll give you something that checks a surprising number of boxes, maybe not perfect, maybe not production-ready, but close enough that the old signals don't mean what they used to mean, and that's been bothering me more than I expected.

TanStack is in a weird and important spot right now. We're building tools for the future of AI, whether that's agents reading docs, models calling typed tools, software writing software, or developers handing off more and more work to systems that need APIs and state and errors to be extremely clear. A lot of what we're building has to be good for machines, but I really, really don't want TanStack to feel machine-made.

These libraries come from real people who have lived these problems for years, and we know why server state gets messy because we've been in the app at midnight trying to figure out why the UI is lying. We know why routing is hard because we've watched apps slowly turn into piles of special cases, and we know why tables and forms and databases and AI workflows can eat your whole life if the primitives underneath them are wrong.

The whole point of TanStack has always been to give some of that life back. If TanStack Query makes you stop worrying about a class of bugs, that's time back. If Router gives you a route tree you can trust, that's time back. If Table or Form keeps you from rebuilding the same pile of state management for the tenth time, that's time back. If Start or DB or AI can remove some of the machinery that usually sits between you and the product you're trying to ship, that's time back.

And time back is the real product, at least to me.

The beach thing stuck around because of that. The palm tree, the island, the relaxed vibe, all of it can look kind of silly from the outside if you reduce it to a mascot or a decoration, but for me it has always been the easiest visual way to say "you're in good hands, go enjoy your life." Go outside, go be with your family, go cook something, go sit in the shade, go touch sand if touching grass isn't beachy enough, your software should not need you hovering over it forever.

I want TanStack to earn that feeling.

The old brand pointed at that idea, but it didn't really carry it. It looked like a clean developer site with some beach energy layered on top, again, not bad, just not honest enough for where we are now. It didn't show enough hand, it didn't feel like someone made hard choices, and it felt a little too easy to reproduce, which in 2026 is a real problem.

The new brand is trying to fix that without turning TanStack into some over-designed art project, because I don't want that either. I don't want a site that screams "look how designed this is," I want it to feel careful, warm, a little imperfect in the places where perfection would make it feel fake, restrained in the places where AI would let us do literally anything, more like someone chose a few things on purpose and then had the discipline to stop.

AI makes it feel like you can do everything, all the time, instantly, more gradients, more motion, more variations, more generated texture, more content, more pages, more everything, but I think the bar for human quality is going the other direction. The bar is knowing what to refuse, choosing the one thing that matters and doing that thing with enough attention that people can feel the difference, even if they can't explain every choice.

That's also how I want TanStack tools to feel. They should be sharp, typed, inspectable, composable, and boring in the places where boring means dependable, and they should have escape hatches because real apps need them, but also enough taste baked in that you're not constantly rebuilding the same decisions. They should work for developers today and agents tomorrow without pretending those are separate worlds.

That's a lot for a logo and a website to carry, but brand is mostly a bunch of small choices adding up until people can tell whether you care.

Andy Beutler is TanStack's first lead designer, which is still kind of wild to say because we've made it this far without that role. For years, the "design system" was basically engineering taste, maintainer instinct, a pile of Tailwind classes, and whatever consistency we could remember while also shipping libraries, docs, examples, sponsors, merch, and a thousand other things.

It worked better than it probably should have, but it was starting to crack, and Andy can focus in a way the rest of us couldn't without stealing time from the real product. He's been giving TanStack something we haven't really had before, a design spine, and that work is showing up now as the new logo system, global type, design tokens, `/ds`, a component kit, Phosphor icons, and yes, a little palm loader that makes me happier than a loader probably should.

The design system itself will live at [/ds](/ds), and that's probably the part of this launch I'm most excited to keep building on because it turns taste into something shareable. Colors have primitive ramps and semantic tokens now, type has roles instead of vibes, components have one home, and that sounds boring until you've maintained a site for years and realized every one-off button or color choice is really just future work with a nicer shirt on.

![TanStack design system snapshot](/blog-assets/tanstack-has-a-new-look/design-system-snapshot.svg)

The checklist isn't the reason I'm excited though, I'm excited because we finally have something to make decisions against. When a page feels off, we can point to why, when a component needs to exist, it has somewhere to live, and when the site starts drifting, there's gravity now.

The launch this week isn't the finish line. Some pages will still need work, some things will still feel halfway between the old world and the new one, and that's okay. I'd rather have a real foundation and keep moving than pretend a rebrand is one magical day where everything becomes perfect.

What I care about is that TanStack is starting to look more like the thing I've always wanted it to be, precise tools made by humans, for humans, in a world where more of the work is going to be done with machines.

That's the balance I don't want to lose.

We can build for AI without sounding like AI, we can make things machine-readable without making them soulless, and we can care about type safety and protocol details and state graphs and still admit that the reason any of this matters is because people want to build something and then go live their actual lives.

So yeah, TanStack has a new look, new logo, new type, new system, new vibe, and hopefully a little more evidence that there are actual people here making actual choices.

That's what I want the brand to say now, you're in good hands, we care more than the tidy version of the site used to show, and if we do our job right, you can stop worrying about the software for a bit and go be a person.
