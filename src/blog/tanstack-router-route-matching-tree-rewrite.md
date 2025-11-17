---
title: Performant Route Matching in TanStack Router
published: 2025-11-18
authors:
  - Florian Pellet
---

![Big performance number](/blog-assets/tanstack-router-route-matching-tree-rewrite/header.png)

We achieved a 20,000× performance improvement in route matching in TanStack Router. Let's be honest, this is *definitely* cherry-picked, but it's a real number using a real production application. And it demonstrates something important: matching a pathname to a route is no longer bottlenecked by the number of routes in your application.

## The Real Problem: correctness, not speed

One big responsibility of a router is to match a given URL pathname (e.g., `/users/123`) to a route definition (e.g., `/users/$userId`). This is deceptively complex when you consider all the different types of route segments (static, dynamic, optional, wildcard) and the priority rules that govern which route should match first.

We used to have a route matching algorithm that would look through every route in the route tree, and through a mix of pattern matching, manual look-aheads, and recursion, find the best match. With the introduction of more features like optional segments and wildcards, the algorithm became increasingly complex and slow, and we started getting reports of incorrect matches.

We opted for a complete rewrite: we now parse the route tree into a segment trie, and matching is done by traversing this trie. This makes it much simpler to implement exact matching rules while ensuring high performance.

## Algorithmic Complexity

The reason we can get such a massive performance boost is because we've changed which variable drives the complexity of the algorithm. The bigger the route tree, the bigger the performance gain.

- Old approach: `O(N)` where `N` is the number of routes in the tree.
- New approach: `O(M)` where `M` is the number of segments in the pathname.

Using this new trie structure, each check eliminates a large number of possible routes, allowing us to quickly zero in on the correct match.

Say for example we have a route tree with 450 routes (pretty big app) and the tree can only eliminate 50% of routes at each segment check (this is unusually bad, it's often much higher). In 9 checks we have found a match (`2**9 > 450`). By contrast, the old approach *could* have found the match on the first check, but in the worst case it would have had to check all 450 routes, which yields an average of 225 checks. Even in this bad, simplified, and very unusual case, we are looking at a 25× performance improvement.

This is what makes tree structures so powerful.

In practice, we've observed:
- Small apps (10 routes): 60× faster
- Big apps (450 routes): 10,000× faster

These are lower than 20,000×, but they are still insane numbers. Yet they still aren't the full story.

## Fun Implementation Details

Beyond choosing the right data structures, working on performance is usually about avoiding death by a thousand cuts: avoiding memory allocations, skipping work, ... Here are some of the fun implementation details that helped us get to these numbers.

### Backwards Stack Processing

We use a stack to manage our traversal of the trie, because the presence of dynamic segments (`/$required`, `/{-$optional}`, `/$` wildcards) means we may have multiple possible paths to explore at each segment.

The ideal algorithm would be depth-first search (DFS) in order of highest priority, so that we can return as soon as we find a match. In practice, we have very few possibilities of early exit; but a fully static path should still be able to return immediately.

To accomplish this, we use an array as the stack. But we know that pushing to and popping from the end of an array is O(1), while shifting and unshifting from the start is O(N). So we iterate candidates in reverse order of priority at each segment, pushing them onto the stack. This way, when we pop from the stack, we get the highest priority candidate first.

```ts
const stack = [
	{/*initial frame*/}
]
while (stack.length) {
	const frame = stack.pop()

	// search through lowest priority children first (wildcards)
	// search through them in reverse order
	for (let i = frame.wildcards.length - 1; i >= 0; i--) {
		if (matches(...)) {
			stack.push({/*next frame*/})
		}
	}

	// then optional segments
	for (let i = frame.optionals.length - 1; i >= 0; i--) {
		if (matches(...)) {
			stack.push({/*next frame*/})
		}
	}

	// ... static segments last
}
```

### Bitmasking for Optional Segments

Optional segments introduce additional complexity, as they can be present or absent in the URL. While walking the trie, we need to track which optional segments were skipped (i.e. an array of booleans).

Every time we push onto the stack, we need to store the "state at which to pick up from" including which optional segments were skipped. But we don't want to have to `[...copy]` an array of booleans every time we push onto the stack as it would imply many short-lived allocations.

To efficiently handle this, we use bitmasking to represent the presence or absence of each optional segment.

For example, consider a route with two optional segments: `/{-$users}/{-$id}`. We can represent the presence of these segments with a bitmask:
- `00`: no segments skipped
- `01`: only `{-$users}` skipped
- `10`: only `{-$id}` skipped
- `11`: both segments skipped

To write to the bitmask, we use bitwise operators:
```ts
const next = skipped | (1 << depth) // mark segment at 'depth' as skipped
```

And to read from the bitmask:
```ts
if (skipped & (1 << depth)) // segment at 'depth' was skipped
```

The downside is that this limits us to 32 segments, beyond which optional segments will never be considered skipped. We could extend this to a `BigInt` if needed, but for now, it's feels reasonable.


### Reusing Typed Arrays for Segment Parsing

When building the segment trie, we need to parse each route (e.g., `/users/$userId/{-$maybe}`) into its constituent segments (e.g. `static:user`, `dynamic:userId`, `optional:maybe`). Doing this is basically running the same parsing algorithms hundreds of times, every time extracting the same structured data (i.e. segment type, value, prefix, suffix, where the next segment starts, etc).

Instead of re-creating a new object every time, we can reuse the same object across all parsing operations to avoid allocations in the hot path.

```tsx
const data = { kind: 0, prefixEnd: 0, suffixStart: 0, nextCursor: 0 }
do {
	parseSegment(path, data)
	// ...
} while (data.nextCursor)
```

Technically, we can push this even further by using a `Uint16Array` to store the data, which is more memory efficient and faster to access than object properties. And TypeScript handles this very well, so we don't need to type the buffer or even initialize it.

```ts
let data
let cursor = 0
while (cursor < path.length) {
	data = parseSegment(path, cursor, data)
	cursor = data[5]
	//       ^? let data: Segment
}

type Segment = Uint16Array & {0: SegmentKind, 1: number, 2: number, ... }
function parseSegment(
	path: string,
	cursor: number,
	data: Uint16Array = new Uint16Array(6)
): Segment {}
```

### Least Recently Used (LRU) Caching

Because the route tree is static after initialization, a URL pathname will always yield the same match result. This makes this an ideal candidate for caching.

```ts
const cache = new Map<string, MatchResult>()
function match(pathname: string): MatchResult {
	const cached = cache.get(pathname)
	if (cached) return cached
	const result = performMatch(pathname)
	cache.set(pathname, result)
	return result
}
```

With a cache, we only need to do the expensive matching operation once per unique pathname. Subsequent requests for the same pathname will be served from the cache, which is O(1).

However, as we've seen before, some apps can have a very large number of unique routes, which means even more unique pathnames (e.g., route `/user/$id` is matched by `/user/1`, `/user/2`, etc). To prevent unbounded memory growth, we implement a Least Recently Used (LRU) cache that automatically evicts the least recently used entries when the cache reaches a certain size.

[See implementation.](https://github.com/TanStack/router/blob/f830dffb7403819ea984017bb919b4a8708f24a5/packages/router-core/src/lru-cache.ts)

This data structure performs about half as well as a regular `Object` for writes, and on par with an `Object` for reads. This is a trade-off we are willing to make to avoid unbounded memory growth.

![benchmark results for LRU cache vs Object vs Map](/blog-assets/tanstack-router-route-matching-tree-rewrite/lru-benchmark.png)

## The full story

The numbers we've presented so far are impressive. They're also cherry-picked from the biggest apps we tested, which is biased in favor of the new algorithm. They're also comparisons against the old, uncached algorithm. In reality, we've added caching a while ago. We can see the full progression over the last 4 months:

![route matching performance over 4 evolutions of the algorithm](/blog-assets/tanstack-router-route-matching-tree-rewrite/matching-evolution-benchmark.png)

And besides that, they also focus on a small part of the router's performance profile. Matching a pathname to a route is only one part of the job. If we look at a "fuller" functionality, for example `buildLocation`, which involves matching, building the location object, interpolating the path, passing the validation functions, running the middlewares, etc, we see a more modest but still significant improvement:

![buildLocation performance over 4 evolutions of the algorithm](/blog-assets/tanstack-router-route-matching-tree-rewrite/buildlocation-evolution-benchmark.png)

Even the smallest apps see some improvement here, but it might not feel as dramatic. We will continue to optimize the other parts of the router to make it feel as snappy as we can. But at least route matching is no longer a bottleneck!

## Going even further

While we are very happy with these results (and are probably done optimizing route matching for now), there are still some avenues we could explore to push this even further:

- **sub-segment nodes**: currently, each node in the trie represents a full URL segment (between slashes). We could further break down segments into sub-segments (e.g., prefix, dynamic part, suffix) to allow for much better branch elimination. This is what [`find-my-way`](https://github.com/delvedor/find-my-way) does (the router behind [Fastify](https://www.fastify.io/)), and it yields impressive results.

- **branch compression**: we could also expand in the other direction, and have tree nodes that represent multiple segments at once, when there is no branching (usually, for a series of static segments). This would reduce the depth of the tree and the number of stack frames we need to process.

---

This wasn't a "let's make it faster" project, it was a "let's make it correct" project that happened to yield massive performance improvements as a side effect. I rarely have the opportunity to see such big numbers when I benchmark stuff, so I hope you didn't mind my cherry-picking a bit for this post.
