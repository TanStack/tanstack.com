---
title: Announcing TanStack Form v1
published: 2025-03-03
authors:
  - Corbin Crutchley
---

![TanStack Form v1](/blog-assets/announcing-tanstack-form-v1/form_header.png)

We're excited to announce the first stable version of [TanStack Form](/form/v1) is live and ready for usage in production! 🥳

We support five frameworks at launch: React, Vue, Angular, Solid, and Lit, as well as a myriad of features for each specific framework.

# How to install

```shell
$ npm i @tanstack/react-form
# or
$ npm i @tanstack/vue-form
# or
$ npm i @tanstack/angular-form
# or
$ npm i @tanstack/solid-form
# or
$ npm i @tanstack/lit-form
```

# A bit of history

It was nearly two years ago when [I saw Tanner's BlueSky (an invite-only platform at the time) post announcing that he was working on a new project: TanStack Form](https://bsky.app/profile/tannerlinsley.com/post/3ju5z473w5525).

![A back and forth between Tanner and myself on Bluesky about TanStack Form](/blog-assets/announcing-tanstack-form-v1/tanstack_form_bluesky_announce.png)

At the time, I had just launched an alternative form library for React called "[HouseForm](https://web.archive.org/web/20240101000000*/houseform.dev)" and I was immediately enamored by some of the ideas Tanner's library brought to the table.

I was fortunate enough to attend a hackathon that Tanner was also going to soon after and we were able to get some time to work on integrating some APIs from HouseForm into the project.

Since that time, Tanner's handed much of the reigns of Form over to me and a wonderful group of additional maintainers.

So, what have we built in that time?

# Features

One of the advantages of being in the oven for so long is that TanStack Form launches with a flurry of features you can leverage day one.

Let's go over _just a few_ of them using React's adapter as examples.

## Extreme type safety

Like many all of the TanStack projects, Form has revolutionized what it means to be a "type-safe" form library.

```tsx
const form = useForm({
	defaultValues: {
        name: "",
        age: 0
    }
});

// TypeScript will correctly tell you that `firstName` is not a valid field
<form.Field name="firstName"/>

// TypeScript will correctly tell you that `name`'s type is a `string`, not a `number`
<form.Field name="name" children={field => <NumberInput value={field.state.value}/>}/>
```

We even support type-checking what errors are returned in `<form.Field>`:

```tsx
<form.Field
  name="age"
  validators={{
    onChange: ({ value }) => (value < 12 ? { tooYoung: true } : undefined),
  }}
  children={(field) => (
    <>
      <NumberInput value={field.state.value} />
      // TypeScript will correctly tell you that `errorMap.onChange` // is an object,
      not a string
      <p>{field.state.meta.errorMap.onChange}</p>
    </>
  )}
/>
```

> Oh, yeah, we support field-based validation as well as form validation. Mix-n-match them!

The best part? [You won't need to pass any typescript generics to get this level of type safety](/form/latest/docs/philosophy#generics-are-grim). Everything is inferred from your runtime usage.

## Schema validation

Thanks to the awesome work by the creators of [Zod](http://zod.dev/), [Valibot](https://valibot.dev), and [ArkType](https://arktype.io/), we support [Standard Schema](https://github.com/standard-schema/standard-schema) out of the box; no other packages needed.

```tsx
const userSchema = z.object({
  age: z.number().gte(13, 'You must be 13 to make an account'),
})

function App() {
  const form = useForm({
    defaultValues: {
      age: 0,
    },
    validators: {
      onChange: userSchema,
    },
  })
  return (
    <div>
      <form.Field
        name="age"
        children={(field) => {
          return <>{/* ... */}</>
        }}
      />
    </div>
  )
}
```

## Async validation

That's not all, though! We also support async functions to validate your code; complete with built-in debouncing and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)-based cancellation:

```tsx
<form.Field
  name="age"
  asyncDebounceMs={500}
  validators={{
    onBlurAsync: async ({ value, signal }) => {
      const currentAge = await fetchCurrentAgeOnProfile({ signal })
      return value < currentAge ? 'You can only increase the age' : undefined
    },
  }}
/>
```

## Platform support

Not only do we support multiple frameworks as we mentioned from the start; we support multiple runtimes. Whether you're using React Native, NativeScript, or even SSR solutions like Next.js or [TanStack Start](/start), we have you covered.

In fact, if you're using SSR solutions, we even make server-side form validation a breeze:

```typescript
// app/routes/index.tsx, but can be extracted to any other path
import { createServerValidate, getFormData } from '@tanstack/react-form/start'
import { yourSchemaHere } from '~/constants/forms'

const serverValidate = createServerValidate({
  ...formOpts,
  onServerValidate: yourSchemaHere,
})

export const getFormDataFromServer = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getFormData()
  }
)
```

> This code sample excludes some of the relevant code to keep things glanceable. [For more details on our SSR integration, please check our docs.](/form/latest/docs/framework/react/guides/ssr)

And boom, the exact same validation logic is running on both your frontend and backend. Your forms will even show errors when JavaScript is disabled on the user's browser!

# A look forward

We're not resting on our laurels, however - we have plans to add new features to v1 now that we're stable. These features include:

- [Persistence APIs](https://github.com/TanStack/form/pull/561)
- [A Svelte 5 adapter](https://github.com/TanStack/form/issues/516)
- [Better DX for transforming values on submission](https://github.com/TanStack/form/issues/418)
- [Form Groups](https://github.com/TanStack/form/issues/419)

And much more.

# Thank **you**

There's so many people I'd like to thank that once I'd gotten started I'd never end. Instead, I'll address each group of folks I want to thank.

- Thank you to our contributors: So many people had to come together to make this happen. From maintainers of other TanStack projects giving us guidance, to drive-by PRs; it all helped us get across the line.

- Thank you to our early adopters: The ones who took a risk on us and provided invaluable feedback on our APIs and functionality.
- Thank you to the content creators who covered our tools: You brought more eyes to our project - making it better through education and feedback.
- Thank you to the broader community: Your excitement to use our tools have driven the team immensely.

And finally, thank **you** for taking the time to read and explore our newest tool. ❤️
