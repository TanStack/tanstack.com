---
title: 'We Removed 3rd Party Ads from TanStack.com'
published: 2026-03-24
excerpt: Cutting ad-tech and tracking overhead turned a pathological request graph into something sane again, and made the remaining first-party performance work finally obvious.
authors:
  - Tanner Linsley
---

![We Removed Third-Party Ads. tanstack.com Got Faster.](/blog-assets/removing-third-party-ads/header.jpg)

For a long time, third-party ads on tanstack.com sat in an uncomfortable category for me: useful, but increasingly hard to justify.

They helped fund the work. That part was real. When you are trying to run a serious open-source business without paywalls, VC, or licensing games, you do not casually throw away revenue. And ad revenue has a dangerous quality to it: it can feel free. Drop in the scripts, let the machinery run, and money shows up.

What changed is that our partnership revenue finally reached the point where the ROI made sense to let the ad stack go. We had another engine for sustainability. That gave us room to stop optimizing for money that felt easy and start optimizing harder for product quality.

But the cost was real too. More third-party JavaScript, more request fanout, more main-thread contention, more tracking surface area, and a worse experience for people who were just trying to read docs. The site was carrying around a small ad-tech zoo, and every optimization pass kept running into the same truth: a lot of the slowness was not ours.

At some point you have to decide what business you are actually in. We're in the business of making the web feel faster, simpler, and more reliable. So we made the call to remove third-party ads from tanstack.com. Not reduce them. Not defer them. Remove them.

We kept the ad real estate, but stopped letting Publift, Fuse, and the rest of the auction stack run the page. Then we measured the before and after.

For the latest pass, I reran mobile Lighthouse against just three pages on the old site and the current site:

- `/`
- `/query`
- `/query/latest/docs/framework/react/guides/queries`

## The Before and After

> I am not presenting these as triumphant final numbers. They are not. There is still a lot of work left to do, especially on the docs side. But this post is about the changes we made and what those changes bought us, not pretending the work is finished.

Across the three production pages I care most about, the current site now lands between **51.5** and **80** on two-run mobile averages. That is still not amazing or perfect, but it is a very different place than the old site.

The homepage is the cleanest place to start.

| Metric           | Old homepage | Current homepage |
| ---------------- | -----------: | ---------------: |
| Lighthouse score |       **37** |           **80** |
| FCP              |         4.5s |             3.0s |
| LCP              |         6.8s |             3.9s |
| TBT              |      1,370ms |            171ms |
| TTI              |        34.3s |             5.4s |
| Script transfer  |     1.95 MiB |          547 KiB |
| Total transfer   |     13.1 MiB |          830 KiB |
| Requests         |          103 |               61 |
| Domains          |           17 |                3 |

That alone would have been a worthwhile cleanup.

The biggest win after that was the Query landing page. The old `/query` run was a disaster. The current `/query/latest` page is not perfect, but it is finally behaving like a real product page instead of an out-of-control dependency graph.

| Metric           | Old `/query` | Current `/query/latest` |
| ---------------- | -----------: | ----------------------: |
| Lighthouse score |       **31** |                **78.5** |
| FCP              |         3.9s |                    2.9s |
| LCP              |         7.1s |                    4.5s |
| TBT              |      2,110ms |                    66ms |
| TTI              |        47.6s |                    5.3s |
| Script transfer  |     5.04 MiB |                 532 KiB |
| Total transfer   |     93.5 MiB |                 676 KiB |
| Requests         |          718 |                      60 |
| Domains          |           37 |                       5 |

That is the kind of improvement that changes how a page feels, not just how a benchmark reads.

But the docs page is the right place to look if you want to understand the work that is still left.

| Metric           | Old docs page | Current docs page |
| ---------------- | ------------: | ----------------: |
| Lighthouse score |        **32** |          **51.5** |
| FCP              |          6.1s |              5.7s |
| LCP              |         18.8s |              9.0s |
| TBT              |       1,960ms |             374ms |
| TTI              |         19.7s |              9.0s |
| Script transfer  |      2.38 MiB |           1.1 MiB |
| Total transfer   |      2.83 MiB |          1.29 MiB |
| Requests         |           116 |                99 |
| Domains          |            17 |                 5 |

That `80` on the homepage is not a promise that every Lighthouse run will land there forever. Lighthouse has variance. I do not care about pretending otherwise. But the direction here is not subtle.

It is also worth saying plainly: these numbers are not the ceiling of what [TanStack Start](/start) can do. TanStack Start is extremely fast and lightweight. If anything, this post is about us getting tanstack.com closer to being the kind of showcase it should already be. This is a stepping stone, not the limit.

## What Removing the Ad Stack Actually Bought Us

This was not just a Lighthouse-number cleanup. It simplified the page. The homepage now loads less JavaScript, talks to fewer systems, and does less work before it becomes useful.

And yes, the ad-heavy version could get absurd. In the latest rerun, the old homepage still pushed more than **13 MiB**. The old `/query` result was much worse: **93.5 MiB** total transfer and **718** requests. That is not a healthy page. That is a page losing control of its own dependency graph.

And more importantly, the page stopped pulling in a bunch of third-party ad infrastructure:

- `cdn.fuseplatform.net`
- `securepubads.g.doubleclick.net`
- `c.amazon-adsystem.com`
- `config.aps.amazon-adsystem.com`
- `cdn.id5-sync.com`
- `cdn.confiant-integrations.net`
- `metrics.rapidedge.io`

Those are not harmless little tags. They bring auctions, identity sync, dependency chains, and whatever surprises their vendors decide to ship next.

After the change, the remaining third-party footprint on the homepage is much narrower. We removed GTM and Funding Choices too, so at this point it is mostly direct analytics and monitoring:

- Google Analytics
- Sentry

That is still not free, but it is a much smaller and more understandable trade.

## Bundle Size, JavaScript, and Cookies

Removing the ad stack did not fix everything by itself. We also kept doing normal performance work: trimming homepage code, deferring non-critical work, and cutting font payload. But removing ads was one of the cleanest wins because it improved multiple things at once:

- less JavaScript loaded
- fewer third-party origins
- fewer chained requests
- less main-thread contention
- smaller cookie and privacy surface area

That last one matters more than people admit. Even when consent tooling is present, an ad-tech stack tends to expand the number of systems touching identity, storage, and page lifecycle. Killing that whole class of dependencies is cleaner than trying to politely optimize it.

## What We Do Instead Now

We still have promotional real estate on the site, but now it is ours. That means TanStack products, our own announcements, and carefully chosen partnerships that we can serve directly without dragging in an auction waterfall. If something shows up on tanstack.com, it should earn its place.

No mystery JavaScript. No third-party ad network stack. No performance tax disguised as monetization.

## What Still Needs Work

This is not the end of the performance story. It is the point where the remaining work becomes more honest.

The homepage is now in good shape. The Query landing page is much healthier too. The docs pages are where the remaining weight is concentrated.

In our latest production mobile checks, the averages looked like this:

- homepage: **80**
- Query landing page: **78.5**
- Query docs page: **51.5**

That gap matters. And the reason is not mysterious.

Right now, too much of our docs rendering pipeline still ends up in the client. On the docs page we measured about **1.1 MiB** of script transfer, and about **358 KiB** of that is clearly tied to syntax highlighting alone: Shiki, its WebAssembly payload, themes, and language chunks.

The markdown side is not fully out of the client either. Our docs component still renders markdown in React on the client path, and the markdown processor stack also shows up in client chunks. That means the browser is still paying for work that should mostly be done before hydration ever starts.

That is exactly why I am excited about React Server Components here. And this is where a lot of people talk past each other.

RSCs are not magic. They are just a good fit when you are optimizing for the right thing.

In our case, the docs are mostly content at the end of a markdown pipeline that rarely changes. We care a lot about fast page loads, content retrieval, mobile devices, and shorter sessions. In that world, it makes perfect sense to do the markdown rendering and syntax highlighting on the server. The browser should get HTML, not a markdown pipeline. It should get highlighted code, not a syntax highlighter and a wasm runtime.

If this were a client-heavy SPA, a dashboard, or an application where users stay in one session for a long time, the tradeoff could look different. In that case, shipping a markdown or highlighting pipeline once, paying the bundle cost, and amortizing it over the whole session can be completely reasonable, especially if it is lazy loaded.

But that is not the optimization target here. Docs are not a dashboard. They are content. And for content like this, RSCs are a very good fit because they let us push the expensive pipeline work back to the server where it belongs.

There will still be some client-side UI left for truly interactive bits. That is fine. But the heavy docs rendering path should not live there forever.

So this ad-removal work is not the finish line. It is the cleanup pass that made the next layer of work obvious. We removed the third-party chaos first. Now we can go after the first-party rendering costs with much clearer visibility.

## The Tradeoff

I do not regret using ads when we needed them. They helped fund the work during an earlier stage, and I am grateful for that. But once partnership revenue crossed the right threshold, the calculus changed. Keeping the ad stack around meant saying goodbye to product quality in exchange for money that felt free.

Performance is not a vanity metric for us. It is part of the product. So we made the call. The site is faster. The dependency graph is smaller. The privacy surface is smaller. The homepage feels more like ours.

That is a trade I would make again.
