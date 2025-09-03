# Project Structure

```
/tanstack-start-project
├── src/
│   ├── routes/
│   │   ├── __root.tsx                    # Root layout
│   │   ├── index.tsx                     # Home page
│   │   ├── demo.start.server-funcs.tsx   # Demo server functions
│   │   └── demo.start.api-request.tsx    # Demo API request
│   ├── router.tsx                        # Router configuration
│   ├── routeTree.gen.ts                  # Generated route tree
│   └── styles.css                        # Global styles
├── public/                               # Static assets
├── vite.config.ts                        # Vite configuration
├── package.json                          # Project dependencies
└── tsconfig.json                         # TypeScript configuration
```

Optionally:

```
├── src/
│   ├── components/                       # React components
│   │   ├── ui/                           # Shadcn components
│   ├── hooks/                            # Global hooks
│   ├── lib/                              # Shared business logic modules
```

# Page Routes

## Create A Simple Page Route

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: PageComponent,
});

function PageComponent() {
  return <div>Hello World</div>;
}
```

## Create A Lazily Imported Route

```ts
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: lazyRouteComponent(() => import("./Post")),
});

function PageComponent() {
  return <div>Hello World</div>;
}
```

## Create An Authenticated Route

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: PageComponent,
});

function PageComponent() {
  return <div>Hello World</div>;
}
```

### Page with Error Handler

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error, reset }) => {
    return (
      <div>
        {error.message}
        <button
          onClick={() => {
            // Reset the router error boundary
            reset()
          }}
        >
          retry
        </button>
      </div>
    )
  },
  component: PageComponent,
})

function PageComponent() {
  return <div>Hello World</div>
}
```

## Parameterized Routes

### Create A Parameterized Page Route

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId")({
  component: PageComponent,
});

function PageComponent() {
  const { postId } = Route.useParams();
  return <div>Post: {postId}</div>;
}
```

### Create A Parameterized Page Route (with a selector)

```ts
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId")({
  component: PageComponent,
});

function PageComponent() {
  const postId = useParams({
    from: "/posts/$postId",
    select: (params) => params.postId,
  });
  return <div>Post: {postId}</div>;
}
```

## Links

### Simple Route Link

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return <Link to="/some-page">Some Page</Link>
}
```

### Link With Typed Parameters

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return (
    <Link to="/user/$userId" params={{ userId: 25 }}>
      User Information
    </Link>
  )
}
```

### Link With Search Parameters

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return (
    <Link to="/home" search={(prev) => ({ ...prev, foo: 'bar' })}>
      Click me
    </Link>
  )
}
```

### Link With Active and Inactive Styling

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return (
    <Link
      to="/home"
      activeProps={{ fontWeight: 'bold' }}
      inactiveProps={{ fontStyle: 'italic' }}
    >
      Click me
    </Link>
  )
}
```

### Navigate On-Demand

```tsx
import { useNavigate } from '@tanstack/react-router'

function Component() {
  const navigate = useNavigate()

  const onClick = () =>
    navigate({
      to: '/posts/$postId',
      params: {
        postId: 'my-first-blog-post',
      },
    })
}
```

## Loaders

### Loading a Page With Sychronous Data

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/names")({
  loader: () => ({ names: ["Jack"] }),
  component: PageComponent,
});

function PageComponent() {
  const { names } = route.useLoaderData();

  return <div>{JSON.stringify(names)}</div>;
}
```

### Loader With Path Parameters

```ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params: { postId } }) => fetchPostById(postId),
})
```

### Loader With Search Parameters

```ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  validateSearch: (search) =>
    search as {
      offset: number
      limit: number
    },
  loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
  loader: ({ deps: { offset, limit } }) =>
    fetchPosts({
      offset,
      limit,
    }),
})
```

### Loader With Abort Signal

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: ({ abortController }) =>
    fetchPosts({
      signal: abortController.signal,
    }),
})
```

### Wrap Promise Returned From Page Loader with Component

```ts
import { createFileRoute, Await } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    const deferredPromise = defer(fetch("/api/data"));
    return { deferredPromise };
  },
  component: PageComponent,
});

function PageComponent() {
  const { deferredPromise } = route.useLoaderData();

  return (
    <Await promise={deferredPromise}>
      {(data) => <div>{JSON.stringify(data)}</div>}
    </Await>
  );
}
```

### Get Data Returned From Promise In Loader Using a Hook

```ts
import { createFileRoutem, useAwaited } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    const deferredPromise = defer(fetch("/api/data"));
    return { deferredPromise };
  },
  component: PageComponent,
});

function PageComponent() {
  const { deferredPromise } = route.useLoaderData();

  /*
  - Throws an error if the promise is rejected.
  - Suspends (throws a promise) if the promise is pending.
  - Returns the resolved value of a deferred promise if the promise is resolved.
  */
  const data = useAwaited({ promise: myDeferredPromise });

  return <div>{JSON.stringify(data)}</div>;
}
```

## Route Matching

### Check For The Current Route

```tsx
import { useMatch } from '@tanstack/react-router'

function Component() {
  const match = useMatch({ from: '/posts', shouldThrow: false })
  //     ^? RouteMatch | undefined
  if (match !== undefined) {
    // ...
  }
}
```

### Show/Hide Component Based on Route

```tsx
import { MatchRoute } from '@tanstack/react-router'

function Component() {
  return (
    <div>
      <MatchRoute to="/posts/$postId" params={{ postId: '123' }} pending>
        {(match) => <Spinner show={!!match} wait="delay-50" />}
      </MatchRoute>
    </div>
  )
}
```

## TanStack Query Integration

### With A Loader

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions } from '@tanstack/react-query'

const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})

export const Route = createFileRoute('/posts')({
  loader: () => queryClient.ensureQueryData(postsQueryOptions),
  component: () => PageComponent,
})

function PageComponent() {
  const {
    data: { posts },
  } = useSuspenseQuery(postsQueryOptions)

  return (
    <div>
      {posts.map((post) => (
        <Post key={post.id} post={post} />
      ))}
    </div>
  )
}
```

## Server Side Rendering

### Disabling Server Side Rendering

```tsx
export const Route = createFileRoute('/posts/$postId')({
  ssr: false,
  beforeLoad: () => {
    console.log('Executes on the client during hydration')
  },
  loader: () => {
    console.log('Executes on the client during hydration')
  },
  component: () => <div>This component is rendered on the client</div>,
})
```

## Server Functions

## Server Function To Return Data

```tsx
import { createServerFn } from '@tanstack/react-start'

export const getData = createServerFn({
  method: 'GET',
}).handler(async () => {
  return { abc: 123 }
})

getData()
```

## Server Function With Arguments

```tsx
import { createServerFn } from '@tanstack/react-start'

export const greet = createServerFn({
  method: 'GET',
})
  .validator((data: string) => data)
  .handler(async (ctx) => {
    return `Hello, ${ctx.data}!`
  })

greet({
  data: 'John',
})
```

### Server Function With A Validation Library

Validation libraries like Zod can be used like so:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod/v4'

const Person = z.object({
  name: z.string(),
})

export const greet = createServerFn({ method: 'GET' })
  .validator((person: unknown) => {
    return Person.parse(person)
  })
  .handler(async (ctx) => {
    return `Hello, ${ctx.data.name}!`
  })

greet({
  data: {
    name: 'John',
  },
})
```

### Server Function With A Database

```ts
import { createServerFn } from '@tanstack/react-start'

const db = createMyDatabaseClient()

export const getUser = createServerFn(async ({ ctx }) => {
  const user = await db.getUser(ctx.userId)
  return user
})

export const createUser = createServerFn(async ({ ctx, input }) => {
  const user = await db.createUser(input)
  return user
})
```

### Server Function With Raw Fetch Response

```tsx
import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn({
  method: 'GET',
  response: 'raw',
}).handler(async () => {
  // Read a file from s3
  return fetch('https://example.com/time.txt')
})
```

### Server Function Returning Stream

```tsx
import { createServerFn } from '@tanstack/react-start'

export const streamEvents = createServerFn({
  method: 'GET',
  response: 'raw',
}).handler(async ({ signal }) => {
  // Create a ReadableStream to send chunks of data
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial response immediately
      controller.enqueue(new TextEncoder().encode('Connection established\n'))

      let count = 0
      const interval = setInterval(() => {
        // Check if the client disconnected
        if (signal.aborted) {
          clearInterval(interval)
          controller.close()
          return
        }

        // Send a data chunk
        controller.enqueue(
          new TextEncoder().encode(
            `Event ${++count}: ${new Date().toISOString()}\n`,
          ),
        )

        // End after 10 events
        if (count >= 10) {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)

      // Ensure we clean up if the request is aborted
      signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  // Return a streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})
```

### Handling Aborts In Server Functions

```tsx
import { createServerFn } from '@tanstack/react-start'

export const abortableServerFn = createServerFn().handler(
  async ({ signal }) => {
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error('Aborted before start'))
      }
      const timerId = setTimeout(() => {
        console.log('server function finished')
        resolve('server function result')
      }, 1000)
      const onAbort = () => {
        clearTimeout(timerId)
        console.log('server function aborted')
        reject(new Error('Aborted'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  },
)

// Usage
function Test() {
  const controller = new AbortController()
  const serverFnPromise = abortableServerFn({
    signal: controller.signal,
  })
  await new Promise((resolve) => setTimeout(resolve, 500))
  controller.abort()
  try {
    const serverFnResult = await serverFnPromise
    console.log(serverFnResult) // should never get here
  } catch (error) {
    console.error(error) // "signal is aborted without reason"
  }
}
```

### Server Functions With TanStack Query

```tsx
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getServerTime } from './getServerTime'

export function Time() {
  const getTime = useServerFn(getServerTime)

  const timeQuery = useQuery({
    queryKey: 'time',
    queryFn: () => getTime(),
  })
}
```

### Server Functions From Loaders

```ts
import { createServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const getUsers = createServerFn(async () => await db.getUsers());

export const Route = createFileRoute("/posts")({
  loader: () => getUsers(),
  component: PageComponent,
});

function PageComponent() {
  const users = Route.useLoaderData();
  return <div>Hello World</div>;
}
```

## Server Routes

### Simple Server Route

```tsx
import { createServerFileRoute } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/hello').methods({
  GET: async ({ request }) => {
    return new Response('Hello, World! from ' + request.url)
  },
})
```

### Server Route on POST with JSON message body

```tsx
import { createServerFileRoute } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/hello').methods({
  POST: async ({ request }) => {
    const body = await request.json()
    return Response.json({ message: `Hello, ${body.name}!` })
  },
})
```

### Server Route with Route Parameters

```tsx
import { createServerFileRoute } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute(
  '/users/$id/posts/$postId',
).methods({
  GET: async ({ params }) => {
    const { id, postId } = params
    return new Response(`User ID: ${id}, Post ID: ${postId}`)
  },
})
```

### Server Route with Middleware

```tsx
// routes/hello.ts
export const ServerRoute = createServerFileRoute('/hello').methods((api) => ({
  GET: api.middleware([loggerMiddleware]).handler(async ({ request }) => {
    return new Response('Hello, World! from ' + request.url)
  }),
}))
```

### Responding With JSON

```tsx
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    return json({ message: 'Hello, World!' })
  },
})
```

### Responding With A Status Code

```ts
// routes/hello.ts
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request, params }) => {
    const user = await findUser(params.id)
    if (!user) {
      return new Response('User not found', {
        status: 404,
      })
    }
    return json(user)
  },
})
```

### Responding With A Stream

```tsx
import { json } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial response immediately
        controller.enqueue(new TextEncoder().encode('Connection established\n'))

        let count = 0
        const interval = setInterval(() => {
          // Check if the client disconnected
          if (signal.aborted) {
            clearInterval(interval)
            controller.close()
            return
          }

          // Send a data chunk
          controller.enqueue(
            new TextEncoder().encode(
              `Event ${++count}: ${new Date().toISOString()}\n`,
            ),
          )

          // End after 10 events
          if (count >= 10) {
            clearInterval(interval)
            controller.close()
          }
        }, 1000)

        // Ensure we clean up if the request is aborted
        signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      },
    })

    // Return a streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  },
})
```

### Server Route Combined With Page Route

```tsx
// routes/hello.tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFileRoute } from '@tanstack/react-start'

export const ServerRoute = createServerFileRoute('/hello').methods({
  POST: async ({ request }) => {
    const body = await request.json()
    return new Response(JSON.stringify({ message: `Hello, ${body.name}!` }))
  },
})

export const Route = createFileRoute('/hello')({
  component: HelloComponent,
})

function HelloComponent() {
  const [reply, setReply] = useState('')

  return (
    <div>
      <button
        onClick={() => {
          fetch('/hello', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Tanner' }),
          })
            .then((res) => res.json())
            .then((data) => setReply(data.message))
        }}
      >
        Say Hello
      </button>
    </div>
  )
}
```
