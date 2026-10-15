---
title: TanStack Charts 1.0
published: 2026-10-05
draft: false
excerpt: Charts you don’t have to outgrow.
authors:
  - Tanner Linsley
library: charts
headerImage: /blog-assets/tanstack-charts-1-0/poster.jpg
headerVideo: /blog-assets/tanstack-charts-1-0/tanstack-charts-continuing-finale.mp4
headerVideoCaptions: /blog-assets/tanstack-charts-1-0/captions.vtt
---

<!-- Draft for launch. The article uses release-day wording. Before publication, confirm that the 1.0 packages and release are live and that the published documentation reflects the stability promise described below. -->

# TanStack Charts 1.0

## Charts you don’t have to outgrow

TanStack Charts is already getting a 1.0, and I know that’s fast. I have other blog posts that talk about how and why that was possible, but I’d like to talk about why I’m so excited about TanStack Charts.

Getting a line on a screen has never really been the problem. There have been lots of charting libraries and utilities, big and small. I think the really interesting part is what happens down the road, after you build that line chart, as your product grows, your data visualization requirements grow, and your clients demand more detail.

We’d like to think that our charts are just one and done, or even that we could build a couple of chart types and they’ll be sufficient for everything we need. But the reality is that eventually you’ll probably need some bars underneath that line, or you’ll need to highlight a couple of points and throw in a couple of annotations. Oh, and then the tooltip will need to show something specific to your application, not just the chart.

None of this sounds super ambitious. You’re just building your app. I get it. But this is usually where I start finding out which choices a charting library has already made for me.

I’ve spent a lot of time in this space myself, adding wrappers and trying to figure out how far I can push something before I have to start over or build something completely custom. So when I say “charts you don’t have to outgrow,” that’s exactly what I’m talking about. I want you to get a chart working, but then be able to keep using that same system throughout the entire lifespan of that data visualization.

## I have been down this road before

My charting history goes way back to when I was working on Nozzle, my last startup. We had tons of marketing and SEO data, and we needed really useful ways to look at it. I spent lots of time with D3. I even helped maintain and build Chart.js 2.0 alongside Everett Timberg. Then I eventually built react-charts because I wanted my charts to feel more like the way I was building the rest of my UI.

There were a ton of things I liked about each of these projects, and I learned a ton, probably more sometimes than the value I was actually contributing. I spent a lot of time learning about animation, geometry, trigonometry, and label rotation. A little too much about label rotation, because you would never have guessed, but “just figure out how much space that rotated label needs” is a pretty big request, especially when you’re doing everything by hand.

React-charts made a lot of those common cases feel better and fit natively into React. It worked well for a really long time, but eventually I wanted to combine things in ways it hadn’t really been designed for, and react-charts started to feel clunky.

I started studying the Grammar of Graphics, and using Observable Plot helped me see the API I wanted more clearly. I could build a visualization out of smaller pieces, and that felt great. But over time, I was still accumulating wrappers on top of great libraries around the things I wanted to behave differently in my applications.

By the time I actually started building TanStack Charts, I had roughly ten years of pretty specific ideas about what I wanted. Coincidentally, AI came just in time for me to finally try a lot of those ideas without spending multiple years implementing every piece by hand, the way I had in the past.

I designed the API and the experience exactly how I wanted it, and AI handled the implementation. I kept refining how all of it fit together and did have to dive into a few specifics here and there. There was still a lot of polish involved, especially around the type system, because, as you know, I’m a type-safe fanatic.

I [talked more about that recently](https://tannerlinsley.com/posts/ai-open-source-and-the-long-road-to-tanstack-charts) on a long run I did one night, but the part I care about here is really what you get to build with it.

## Keep the pieces you already have

TanStack Charts is built around marks. A line is a mark, points are marks, bars are marks. Scales map your data into the values those marks need, and you compose them with axes and interactions to make your chart.

None of this is really new if you’ve ever used Observable Plot or anything built on the Grammar of Graphics. A lot of this stuff I’m borrowing from people much smarter than me, and I’ve learned that it’s the best way to reason about a charting library.

If you have a line and you want to add points on it, you add points. If you want bars in the same chart, you add the bars. You can keep changing how you show the data without finding or building a new chart type that happens to include the exact combination you need.

That might sound like a really small thing, but it changes how I think while I’m building, and it definitely changes the options I have for charting libraries. I can try something, see how it feels with real data, change it, and massage things around. I don’t have to get every single choice exactly right before I commit to it.

And when you need to do something extremely weird, you can go further. You can create custom marks and scales, build weird interactions and renderers, and dip into the scene contracts they use to really get custom. You can keep the parts that fit and build the parts your application needs.

The tricky part is that the types need to follow you all the way through this process. You’re choosing values from your data, passing them through scales, and mapping them to marks and interactions. If the useful type information disappears halfway through, the API gets a lot less fun to use. Or if you’re using AI, it gets a lot less productive. I thought about that from the beginning because composing really complex charts is exactly when I want the types helping me.

Rendering is yet another choice you have to make as you go. SVG is my default these days, just because working with the Canvas API is a real pain in the butt. I got enough of that doing Chart.js back in the day. But Canvas can come through when you really need it to, and that’s why I made it a separate import and a separate renderer you can bring in when you need it.

This is also how I approached motion and animation. It’s not something that’s just baked in, but it integrates seamlessly as soon as you need it to.

There are also things like compact scales and support for D3 scales. So if you really need things to be super lightweight, you can bring in your own scale implementation and only the pieces you need for the chart you’re making. It turns out AI is also really good at only giving you the pieces you need and keeping things really lightweight, if that’s what you want. So I designed the library to break down into the smallest pieces possible.

I care a lot about keeping these things small. We have tons of bundle budgets, tests, and browser testing around all sorts of changes. Every time we add a feature or fix a bug, we have something really concrete to check. I want to keep adding useful things to the library over time without quietly making everybody pay for all of them and ending up in the same problem space as the libraries I’ve complained about in the past.

## So what does 1.0 mean

1.0 ultimately means I’m ready to support people building on this API.

If you put a TanStack chart into your application, you should be able to update the library without wondering whether you’re going to rebuild it, whether your AI is going to run into problems, or whether your site will build. And if you chose to write a custom mark or renderer, that should count too.

There’s still more I want to do, and 1.0 gives us a clear way to do that while taking care of everybody already using it. When we need to change the API, we’ll need to make sure we figure out a way to get from the old one to the new one. I’m confident that with the contracts we have right now, we’ll be able to do that cleanly.

So there you go. It’s live. Go try it.

Take a chart from your actual application and ask AI to rewrite it with TanStack Charts. Add the thing you’ve been putting off because you weren’t sure how to make it fit. Tell AI to build weird charts and do weird things. See how far you can get, and tell me where it gets awkward.

That’s really the part I’m excited about. I spent years figuring out exactly what I personally wanted from a charting library, but now it’s everyone else’s turn to do the same thing. And I hope TanStack Charts can give it to you.

[Browse the chart catalog](https://tanstack.com/charts/catalog/) or [get started with TanStack Charts](https://tanstack.com/charts/latest).
