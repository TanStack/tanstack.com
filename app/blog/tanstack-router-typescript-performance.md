---
title: A milestone for TypeScript Performance in TanStack Router
---

TanStack Router pushes the boundaries on type-safe routing.

The router's components such as `<Link>` and its hooks such as `useSearch`, `useParams`, `useRouteContext` and `useLoaderData`, infer from the route definitions to offer great type-safety. It's common for applications using TanStack Router to use external dependencies with complex types for `validateSearch`, `context`, `beforeLoad` and `loader` in their route definitions.

While the DX is great, when route definitions accumulate into a route tree and it becomes large, the editor experience can start to appear slow. We've made many TypeScript performance improvements to TanStack Router so that issues only start to appear when the inference complexity becomes very large. We closely watch diagnostics such as instantiations and try to reduce the time TypeScript takes to type-check each individual route definition.

Despite all these past efforts (which certainly helped), we had to address the elephant in the room. The fundamental problem to solve for a great editor experience in TanStack Router was not necessarily related to the overall typescript check time. The problem we've been working to resolve is the bottleneck in the TypeScript language service when it comes to type-checking the accumulated route tree. For those familiar with tracing TypeScript, a trace for a large TanStack Router application could look something similar to the following:

<img src="/blog-tracing-slow.png">

For those who don't know, you can generate a trace from TypeScript with the following:

```
tsc --generatetrace trace
```

This example has 400 route definitions all with `validateSearch` using `zod` and TanStack Query integration through the routes `context` and `loader`'s - it is an extreme example. The large wall at the beginning of the trace is what TypeScript was type-checking when it first hit an instance of the `<Link>` component.

The language server works by type-checking a file (or a region of a file) from the beginning, but only for that file/region. So this meant that the language service had to do this work whenever you interacted with an instance of a `<Link>` component. It turns out, that this was the bottleneck that we were hitting when inferring all the necessary types from the accumulated route tree. As mentioned, route definitions themselves can contain complex types from external validation libraries which then also need inference.

It became quite apparent early on that this was quite clearly going to slow down the editor experience.

## Breaking down work for the language service

Ideally the language service should only need to infer from a route definition a `Link` is navigating to and not the whole route tree. This way the language service only needs to do work necessary to infer types from a single route definition a `Link` navigates to. Unfortunately code based route trees rely on inference to build the route tree which triggers the wall shown above. However with file based, the route tree is generated when a file is created or modified. Previously route trees were created like the following, even for file based.

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

Generating the route tree came as a consequence of reducing tedious configuration of a route tree but keeping inference where it matters. This is where the first important change is introduced leading to better editor performance. Instead of inferring the route tree, we can take advantage of this generation step to _declare the route tree_.

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

Note the use of an `interface` to declare the children to compose the route tree. This process is repeated for all routes and children to create the route tree. After this change, the trace also changed that gave us more insight into what the compiler is now doing.

<img src="/blog-tracing-declare-route-tree.png" />

This is still slow and we're not quite there yet but there is something - _the trace is different_. The inference for the whole route tree is still happening but somewhere else. After working through the types, it turned out to be a type called `ParseRoute`

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

This type walks down the route tree to create a union of all routes. The union in turn is used to create a type mapping from `id` -> `Route`, `from` -> `Route` and also `to` -> `Route`. An example of this mapping exists as a mapped type

```tsx
export type RoutesByPath<TRouteTree extends AnyRoute> = {
  [K in ParseRoute<TRouteTree> as K['fullPath']]: K
}
```

The important realization here is for file based routing we generate the route tree and therefore we don't need to use `ParseRoute` and we can skip this work by generating the mapping type when generating the route tree. Instead we can generate the following:

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

<img src="/blog-tracing-faster.png">

The first file to reference a `Link` no longer triggers inference from the whole route tree which increases perceived language service speed significantly

By doing this TypeScript will only infer the types required for a specific route when it is referenced by a `Link`. This may not translate to overall better typescript check time if all routes are used but is significant for the language service

The difference between the two is striking with large route trees with complex inference (400 in this example)

<div style="display: flex">
  <video src="/language-service-slow.mp4" width="640" height="480" autoplay muted loop></video>
  <video src="/language-service-fast.mp4" width="640" height="480" autoplay muted loop></video>
</div>

You maybe thinking that this is cheating, we are indeed making use of a generation step. However this generation step for file-based (and now virtual file based routing) was always there and a necessary step whenever you modify or create a new route. However once the route is created and the route tree is generated, inference remains throughout anything in a route definition. That means if you make any changes to `validateSearch`, `beforeLoad`, `loader` and others the type is inferred and reflected instantly. The DX in this regard has not changed but the performance in the editor can feel awesome for large route trees

## The ground rules

This change has made a lot of the surface of TanStack Router's exports performant for the language service but there are existing areas which will still fallback to forcing inference on the whole route tree. These areas are a kind of loose or non strict modes.

```tsx
<Link to="." search={{ page: 0 }} />
<Link to=".." search={{page: 0}} />
<Link to="/dashboard" search={prev => ({..prev, page: 0 })} />
```

All three usages of `Link` require inference of the whole route tree and are therefore falling back to a worse editor experience when interacting with them. The first two, TanStack Router does not know what route you want to navigate to and therefore tries its best to guess a very loose type from all routes. The third uses `prev` but TanStack Router does not know what `Route` you are navigating `from` and again tries to guess `prev` with a loose type from all routes. The most performant for your editor is the following:

```tsx
<Link from="/dashboard" search={{ page: 0 }} />
<Link from="/dashboard" to=".." search={{page: 0}} />
<Link from="/users" to="/dashboard" search={prev => ({...prev, page: 0 })} />
```

TanStack Router can narrow the types to specific routes in these cases. This means that you get better type safety and also better editor performance as your application scales. Therefore we encourage the use of `from` or `to` in these cases. To be clear `from` is only necessary if `prev` is used, otherwise TanStack Router does not infer the whole route tree

These looser types also occur in `strict: false` modes.

```tsx
const search = useSearch({ strict: false })
const params = useParams({ strict: false })
const context = useRouteContext({ strict: false })
const loaderData = useLoaderData({ strict: false })
const match = useMatch({ strict: false })
```

In which case for better editor performance and type safety, using `from` is recommended

```tsx
const search = useSearch({ from: '/dashboard' })
const params = useParams({ from: '/dashboard' })
const context = useRouteContext({ from: '/dashboard' })
const loaderData = useLoaderData({ from: '/dashboard' })
const match = useMatch({ from: '/dashboard' })
```

## Moving forward

Going forward we believe TanStack Router is very well positioned to have the best balance between type safety and typescript performance without compromising on inference used throughout route definitions in file (and virtual file) based routing. Everything in your route definitions remains inferred but what gets generated for you is a route tree which helps the language service through inference by declaring types where it matters, something that you would never want to write yourself. This approach also appears scalable for the language service, we were able to create thousands of route definitions and the language service will remain stable provided you keep to the `strict` parts of TanStack Router. We will continue to keep improving TypeScript performance on TanStack Router to reduce overall check time and improve the language service performance further but we think this is an important milestone to share and something we hope users of TanStack Router will appreciate
