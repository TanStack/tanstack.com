---
title: 'How We Track Billions of Downloads: The NPM Stats API Deep Dive'
published: 2025-12-02
authors:
  - Tanner Linsley
---

When you're tracking download stats for an ecosystem of 200+ packages that have been downloaded over 4 billion times, you learn a few things about NPM's download counts API. Some of those lessons are documented. Others you discover the hard way.

This post is about one of those hard-learned lessons: **why we can't just ask NPM for all-time download stats in a single request, and why the approach matters more than you'd think.**

---

## The Two Faces of NPM Stats

NPM offers two endpoints for download statistics:

**The Point Endpoint** (`/downloads/point/{period}/{package}`)

```json
{
  "downloads": 585291892,
  "start": "2024-06-06",
  "end": "2025-12-06",
  "package": "@tanstack/react-query"
}
```

This gives you a single aggregate number. Clean, simple, exactly what you want.

**The Range Endpoint** (`/downloads/range/{period}/{package}`)

```json
{
  "downloads": [
    { "day": "2024-06-06", "downloads": 1904088 },
    { "day": "2024-06-07", "downloads": 1847293 },
    ...
  ],
  "start": "2024-06-06",
  "end": "2025-12-06",
  "package": "@tanstack/react-query"
}
```

This gives you day-by-day breakdowns. More data, but you have to sum it yourself if you want totals.

On the surface, these should return the same numbers. The range endpoint just has more detail, right?

Not quite.

---

## The 18-Month Wall

Here's what the docs say: **both endpoints are limited to 18 months of historical data for standard queries.**

But here's what the docs don't emphasize: when you request more than 18 months, **the API silently truncates your results.**

Let me show you what I mean.

---

## The Experiment

I built a script to test this. Simple premise: query the same packages with both endpoints across different time ranges, and see what happens.

```javascript
// Query @tanstack/react-query for different time periods
const periods = [
  'last-week', // 7 days
  'last-month', // 30 days
  '2024-12-06:2025-12-06', // 12 months
  '2024-06-06:2025-12-06', // 18 months
  '2023-12-07:2025-12-06', // 24 months
  '2015-01-10:2025-12-06', // All-time
]
```

For short periods (7 days, 30 days, 12 months), everything worked perfectly. Both endpoints returned identical data:

```
Last 7 days:
  Point:  13,085,419
  Range:  13,085,419 (7 days)
  ✅ Difference: 0.00%

Last 30 days:
  Point:  54,052,299
  Range:  54,052,299 (30 days)
  ✅ Difference: 0.00%

12 months:
  Point:  479,463,656
  Range:  479,463,656 (366 days)
  ✅ Difference: 0.00%
```

Great! The endpoints match. Time to query all-time stats.

---

## The Plot Twist

Here's where things get interesting:

```
18 months:
  Point:  585,291,892
  Range:  585,291,892 (549 days)
  ✅ Difference: 0.00%

24 months (beyond limit):
  Point:  585,291,892
  Range:  585,291,892 (549 days)
  ✅ Difference: 0.00%

All-time (from 2015):
  Point:  585,291,892
  Range:  585,291,892 (549 days)
  ✅ Difference: 0.00%
```

Notice something? **The numbers are identical for 18 months, 24 months, and all-time.**

Same downloads. Same number of days (549). **Both endpoints are silently capped at roughly 18 months**, returning exactly 549 days of data no matter what date range you request.

This means:

- Requesting "all downloads since 2015" gives you 18 months of data
- The API doesn't tell you it truncated your request
- Both endpoints fail the same way

TanStack Query has been around since 2019. React has been around since 2013. If we just asked NPM for "all-time" stats, we'd be missing **years** of download history.

---

## Proof: The Real Numbers

To validate this, I ran a second test comparing single requests vs properly chunked requests:

**Single Request** (2019-10-25 to today):

```
Downloads: 585,291,892
Days:      549 days
```

**Chunked Requests** (same period, 5 chunks of ~500 days each):

```
Chunk 1 (2019-10-25 → 2021-03-08): 0 downloads
Chunk 2 (2021-03-09 → 2022-07-22): 0 downloads
Chunk 3 (2022-07-23 → 2023-12-05): 86,135,448 downloads
Chunk 4 (2023-12-06 → 2025-04-19): 284,835,067 downloads
Chunk 5 (2025-04-20 → 2025-12-06): 373,366,977 downloads

Total:     744,337,492
Days:      2,235 days
```

**The difference? 159 million downloads.** That's **27% of the data** completely missing from the single request approach.

You can verify this yourself using tools like [npm-stat.com](https://npm-stat.com), which properly implements chunking and shows ~744M downloads for TanStack Query - matching our chunked approach, not the naive single-request number.

---

## Why This Matters

When you're tracking growth for an open source ecosystem, accuracy matters. Not for vanity metrics, but because:

1. **Sponsorship decisions** are made based on real adoption numbers
2. **Contributors want to see impact** from their work
3. **Companies evaluating libraries** look at download trends

If we naively queried for all-time stats, we'd be reporting 585 million downloads for TanStack Query. The real number? **744 million**. That's 159 million downloads (27%) missing.

For the entire TanStack ecosystem with 200+ packages? We'd be off by billions.

---

## The Right Way: Chunked Requests

The solution is to break time into chunks and request each period separately:

```typescript
async function fetchAllTimeDownloads(packageName: string, createdDate: string) {
  const chunks = []
  const maxChunkDays = 500 // Stay under 18-month limit

  let currentDate = new Date(createdDate)
  const today = new Date()

  while (currentDate < today) {
    const chunkEnd = new Date(currentDate)
    chunkEnd.setDate(chunkEnd.getDate() + maxChunkDays)

    if (chunkEnd > today) {
      chunkEnd = today
    }

    const from = formatDate(currentDate)
    const to = formatDate(chunkEnd)

    const url = `https://api.npmjs.org/downloads/range/${from}:${to}/${packageName}`
    const data = await fetchWithRetry(url)

    chunks.push(data)
    currentDate = chunkEnd

    // Small delay to avoid rate limiting
    await sleep(200)
  }

  // Sum all chunks
  return chunks.reduce((total, chunk) => {
    return total + chunk.downloads.reduce((sum, day) => sum + day.downloads, 0)
  }, 0)
}
```

This approach:

- Breaks the timeline into ~17-month chunks (staying safely under the limit)
- Fetches each chunk sequentially to avoid rate limiting
- Sums the results to get true all-time totals
- Includes retry logic for reliability

It's more work, but it's the only way to get accurate historical data.

---

## Point vs Range: Which One?

After all this, you might wonder: should you use `/point/` or `/range/`?

**For all-time stats, use `/range/` with chunking.** Here's why:

1. **They return the same totals** (when you sum the daily breakdowns from range)
2. **Range gives you daily granularity** for trend analysis
3. **Range is what you need for chunking anyway** (you have to sum across chunks)
4. **Both are limited to 18 months**, so there's no advantage to point

The point endpoint is useful for quick spot checks or when you only need recent data. But for building a real stats system, range is the way to go.

---

## Our Implementation

At TanStack, we've built a sophisticated stats system that handles this properly:

- **Automatic chunking** for packages created before 18 months ago
- **Rate limit handling** with exponential backoff
- **Concurrent processing** of 8 packages at a time (to balance speed and API limits)
- **Database caching** with 24-hour TTL to avoid hammering NPM
- **Scheduled refreshes** every 6 hours via Netlify functions
- **Growth rate calculation** from the most recent 7 days for live animations

The full implementation is in [`src/utils/stats.functions.ts`](https://github.com/TanStack/tanstack.com/blob/main/src/utils/stats.functions.ts) if you want to see how we handle the details.

### Library-Level Aggregation

One interesting aspect of our system is how we track stats at the library level. Each TanStack library (Query, Table, Router, etc.) maps to a GitHub repository, and we aggregate downloads for **all npm packages** published from that repo.

This includes:

1. **Scoped packages**: Like `@tanstack/react-query`, `@tanstack/query-core`
2. **Legacy packages**: Like `react-query` (the pre-rebrand name)
3. **Addon packages**: Like `@tanstack/react-query-devtools`, `@tanstack/react-query-persist-client`

For example, TanStack Query's library stats include:

```typescript
// From src/libraries/query.tsx
{
  repo: 'tanstack/query',
  legacyPackages: ['react-query']
}
```

This means our library metrics sum up all related packages, which can include addons and dependencies that might also depend on the core package. This **could inflate library-level numbers** since some downloads might be for packages that themselves depend on other packages in the same library.

We know this. We're keeping it simple for now.

The alternative would be dependency analysis and deduplication - figuring out which packages depend on each other and avoiding double-counting. That's a project for another day. For now, the simple aggregation gives us a reasonable approximation of ecosystem reach, even if it's not perfectly precise.

What matters is consistency: we track the same way over time, so trends and growth rates remain meaningful.

---

## The Results

This approach lets us accurately track downloads across **203 packages** (199 scoped @tanstack/\* + 4 legacy packages), maintaining historical accuracy going back to 2015.

The stats you see on [tanstack.com](/stats) aren't guesses or estimates. They're the sum of thousands of individual API calls, properly chunked, cached, and aggregated.

When we say TanStack has been downloaded over 4 billion times, that number is real. And it's growing by millions every day.

---

## Key Takeaways

If you're building a system to track NPM download stats:

1. **Never trust a single "all-time" request** - it's capped at 18 months
2. **Use the `/range/` endpoint with chunking** for historical accuracy
3. **Implement retry logic** - rate limiting will happen
4. **Cache aggressively** - NPM's data doesn't update instantly
5. **Test your assumptions** - build experiments to verify behavior

The NPM download counts API is powerful, but it has sharp edges. Understanding these limitations is the difference between showing users vanity metrics and giving them real data.

---

## Why This Matters to TanStack

We care about this because **transparency matters**. When we show download stats, we want them to be accurate. When we talk about growth, we want it to be real.

The same principle applies to our libraries. We don't hide complexity behind magic. We build tools that are powerful when you need them to be, and simple when you don't.

That's the TanStack way.

---

**Want to dive deeper into how we build TanStack?** [Join our Discord](https://tlinz.com/discord) where we talk about architecture, API design, and the technical decisions behind the ecosystem.

**Using TanStack and want to support the work?** [Check out our sponsors and partners page](/partners). Every contribution helps us keep building open source the right way.
