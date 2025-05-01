---
title: A milestone for TypeScript Performance in TanStack Router
published: 2024-09-17
authors:
  - Christopher Horobin
---

TanStack Router pushes the boundaries on type-safe routing.

The router's components such as `<Link>` and its hooks such as `useSearch`, `useParams`, `useRouteContext` and `useLoaderData`, infer from the route definitions to offer great type-safety. It's common for applications using TanStack Router to use external dependencies with complex types for `validateSearch`, `context`, `beforeLoad` and `loader` in their route definitions.

While the DX is great, when route definitions accumulate into a route tree and it becomes large, the editor experience can start to appear slow. We've made many TypeScript performance improvements to TanStack Router so that issues only start to appear when the inference complexity becomes very large. We closely watch diagnostics such as instantiations and try to reduce the time TypeScript takes to type-check each individual route definition.

Despite all these past efforts (which certainly helped), we had to address the elephant in the room. The fundamental problem to solve for a great editor experience in TanStack Router was not necessarily related to the overall typescript check time. The problem we've been working to resolve is the bottleneck in the TypeScript language service when it comes to type-checking the accumulated route tree. For those familiar with tracing TypeScript, a trace for a large TanStack Router application could look something similar to the following:

![Tracing showing the route tree being inferred](/blog-assets/tsr-perf-milestone/tracing-slow.png)

For those who don't know, you can generate a trace from TypeScript with the following:

```
tsc --generatetrace trace
```

This example has 400 route definitions all with `validateSearch` using `zod` and TanStack Query integration through the routes `context` and `loader`'s - it is an extreme example. The large wall at the beginning of the trace is what TypeScript was type-checking when it first hit an instance of the `<Link>` component.

The language server works by type-checking a file (or a region of a file) from the beginning, but only for that file/region. So this meant that the language service had to do this work whenever you interacted with an instance of a `<Link>` component. It turns out, that this was the bottleneck that we were hitting when inferring all the necessary types from the accumulated route tree. As mentioned, route definitions themselves can contain complex types from external validation libraries which then also need inference.

It became quite apparent early on that this was quite clearly going to slow down the editor experience.

## Breaking down work for the language service

Ideally, the language service should only need to infer from a route definition, based on where a `<Link>` is navigating `to`, instead of having to crawl the whole route tree. This way the language service would not need to busy itself with inferring the types of route definitions that are not the navigation target.

Unfortunately, code-based route trees rely on inference to build the route tree which triggers the wall shown in the trace above. However, TanStack Router's file-based routing, has the route tree being automatically generated whenever a route is created or modified. This meant that there was some exploration to be done here to see if we could eke out some better performance.

Previously route trees were created like the following, even for file-based routing:

```tsx
export const routeTree = rootRoute.addChildren({
  IndexRoute,
  LayoutRoute: LayoutRoute.addChildren({
    LayoutLayout2Route: LayoutLayout2Route.addChildren({
      LayoutLayout2LayoutARoute,
      LayoutLayout2LayoutBRoute,
    }),
  }),
  PostsRoute: PostsRoute.addChildren({ PostsPostIdRoute, PostsIndexRoute }),
})
```

Generating the route tree came as a consequence of reducing the tedious configuration of a route tree but keeping inference where it matters. This is where the first important change is introduced leading to better editor performance. Instead of inferring the route tree, we can take advantage of this generation step to _declare the route tree_.

```tsx
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LayoutRoute: typeof LayoutRouteWithChildren
  PostsRoute: typeof PostsRouteWithChildren
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LayoutRoute: LayoutRouteWithChildren,
  PostsRoute: PostsRouteWithChildren,
}

export const routeTree = rootRoute._addFileChildren(rootRouteChildren)
```

Note the use of an `interface` to declare the children to compose the route tree. This process is repeated for all routes and their children when generating the route tree. With this change, running a trace gave us a much better idea of what was happening inside the language-service.

![Tracing showing the route tree being declared](/blog-assets/tsr-perf-milestone/tracing-declare-route-tree.png)

This is still slow and we're not quite there yet but there is something - _the trace is different_. The type inference for the entire route tree was still happening, but it was now being done _somewhere else_. After working through our types, it turned out to be happening in a type named `ParseRoute`.

```tsx
export type ParseRoute<TRouteTree, TAcc = TRouteTree> = TRouteTree extends {
  types: { children: infer TChildren }
}
  ? unknown extends TChildren
    ? TAcc
    : TChildren extends ReadonlyArray<any>
    ? ParseRoute<TChildren[number], TAcc | TChildren[number]>
    : ParseRoute<TChildren[keyof TChildren], TAcc | TChildren[keyof TChildren]>
  : TAcc
```

This type walks down the route tree to create a union of all routes. The union in turn is used to create a type mapping from `id` -> `Route`, `from` -> `Route` and also `to` -> `Route`. An example of this mapping exists as a mapped type.

```tsx
export type RoutesByPath<TRouteTree extends AnyRoute> = {
  [K in ParseRoute<TRouteTree> as K['fullPath']]: K
}
```

The important realization here was that when using file-based routing, we were able to skip the `ParseRoute` type entirely by outputting that mapping type ourselves whenever the route tree was generated. Instead, we'd be able to generate the following:

```tsx
export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/posts': typeof PostsRouteWithChildren
  '/posts/$postId': typeof PostsPostIdRoute
  '/posts/': typeof PostsIndexRoute
  '/layout-a': typeof LayoutLayout2LayoutARoute
  '/layout-b': typeof LayoutLayout2LayoutBRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/posts/$postId': typeof PostsPostIdRoute
  '/posts': typeof PostsIndexRoute
  '/layout-a': typeof LayoutLayout2LayoutARoute
  '/layout-b': typeof LayoutLayout2LayoutBRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/_layout': typeof LayoutRouteWithChildren
  '/posts': typeof PostsRouteWithChildren
  '/_layout/_layout-2': typeof LayoutLayout2RouteWithChildren
  '/posts/$postId': typeof PostsPostIdRoute
  '/posts/': typeof PostsIndexRoute
  '/_layout/_layout-2/layout-a': typeof LayoutLayout2LayoutARoute
  '/_layout/_layout-2/layout-b': typeof LayoutLayout2LayoutBRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/posts'
    | '/posts/$postId'
    | '/posts/'
    | '/layout-a'
    | '/layout-b'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/posts/$postId' | '/posts' | '/layout-a' | '/layout-b'
  id:
    | '__root__'
    | '/'
    | '/_layout'
    | '/posts'
    | '/_layout/_layout-2'
    | '/posts/$postId'
    | '/posts/'
    | '/_layout/_layout-2/layout-a'
    | '/_layout/_layout-2/layout-b'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LayoutRoute: typeof LayoutRouteWithChildren
  PostsRoute: typeof PostsRouteWithChildren
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LayoutRoute: LayoutRouteWithChildren,
  PostsRoute: PostsRouteWithChildren,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
```

In addition to declaring children, we also declare interfaces which map paths to a route.

This change along with other type level changes to conditionally use `ParseRoute` only if these types are not registered resulted in a trace which was our aim all along 🥳

![Tracing route tree declaration being inferred faster](/blog-assets/tsr-perf-milestone/tracing-faster.png)

The first file to reference a `<Link>` no longer triggers inference from the whole route tree which increases perceived language service speed. significantly

By doing this, TypeScript will infer the types required for a specific route when it is referenced by a `<Link>`. This may not translate to overall better TypeScript type-checking time when all routes are being linked to, but it is a significant speed increase for the language service when in a file/region.

The difference between the two is striking, as seen in these large route trees with complex inference (400 in this example below):

<div style="display: flex;">
  <video src="/blog-assets/tsr-perf-milestone/language-service-slow.mp4" width="50%" height="480" autoplay muted loop></video>
  <video src="/blog-assets/tsr-perf-milestone/language-service-fast.mp4" width="50%" height="480" autoplay muted loop></video>
</div>

You may be thinking that this is _cheating_ since we are doing a lot of the heavy lifting here in the route tree generation phase. Our response to that is that this generation step for file-based routing (and now virtual file-based routing) was already there and was always a necessary step whenever you modified or created a new route.

So, once a route has been created and the route tree is generated, the inference remains the same throughout everything within the route definition. This means that you can make changes to `validateSearch`, `beforeLoad`, `loader`, and others, with the inferred types always being reflected instantly.

The DX has not changed, but the performance in your editor feels awesome (especially when you are working with large route trees).

## The ground rules

This change involved a lot of TanStack Router's exports being improved to make it more performant to consume these generated types whilst still being able to fall back on the whole route tree inference when using code-based routing. We've also still got areas of the codebase that still rely on the full route tree inference. These areas are our version of a loose/non-strict mode.

```tsx
<Link to="." search={{ page: 0 }} />
<Link to=".." search={{page: 0}} />
<Link to="/dashboard" search={prev => ({..prev, page: 0 })} />
```

All three above usages of `<Link>`, require the inference of the whole route tree and therefore result in a worse editor experience when interacting with them.

In the first two instances, TanStack Router does not know what route you want to navigate to, therefore it tries its best to guess at a very loose type inferred from all the routes in your route tree. The third instance of `<Link>` from above, uses the `prev` argument in the `search` updater function, but in this instance, TanStack Router does not know which `Route` you are navigating `from`, whereby it needs to once again try to guess the loose type of `prev` by scanning the whole route tree.

The most performant usage of `<Link>` in your editor would be the following:

```tsx
<Link from="/dashboard" search={{ page: 0 }} />
<Link from="/dashboard" to=".." search={{page: 0}} />
<Link from="/users" to="/dashboard" search={prev => ({...prev, page: 0 })} />
```

TanStack Router can narrow the types to specific routes in these cases. This means that you get better type safety and better editor performance as your application scales. Therefore, we encourage the use of `from` and/or `to` in these cases. To be clear, in the third example, the usage of `from` is only necessary if the `prev` argument is used, otherwise, TanStack Router does not need to infer the whole route tree.

These looser types also occur in `strict: false` modes.

```tsx
const search = useSearch({ strict: false })
const params = useParams({ strict: false })
const context = useRouteContext({ strict: false })
const loaderData = useLoaderData({ strict: false })
const match = useMatch({ strict: false })
```

In this case, better editor performance and type safety can be achieved by using the recommended `from` property.

```tsx
const search = useSearch({ from: '/dashboard' })
const params = useParams({ from: '/dashboard' })
const context = useRouteContext({ from: '/dashboard' })
const loaderData = useLoaderData({ from: '/dashboard' })
const match = useMatch({ from: '/dashboard' })
```

## Moving forward

Going forward, we believe that TanStack Router is very well positioned to have the best balance between type safety and TypeScript performance, without having to compromise on the quality of the type inference used throughout the route definitions in file-based (and virtual file-based) routing. Everything in your route definitions remains inferred, with the changes in the generated route tree only aiding the language service by declaring the necessary types where it matters, something that you would never want to write yourself.

This approach also looks to be scalable for the language service. We were able to create thousands of route definitions with the language service remaining stable provided you keep to the `strict` parts of TanStack Router.

We will continue to keep improving TypeScript performance on TanStack Router to reduce overall check time and improve the language service performance further, but still felt that this was an important milestone to share and something we hope the users of TanStack Router will appreciate.
