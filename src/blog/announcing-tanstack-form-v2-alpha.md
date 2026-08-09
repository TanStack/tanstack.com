---
title: 'Form v2 is here: All you need to know about the alpha'
published: 2026-08-06
excerpt: TanStack Form v2
library: form
authors:
  - Luca Jakob
---

![View from a steep cliff overlooking an ocean shoreline](/blog-assets/announcing-tanstack-form-v2-alpha/header.png)

TanStack Form v1 has been out for over a year, giving us plenty of time to see what worked and where people got stuck. We collected that feedback and spent the last few months rebuilding the library from the ground up. The core rewrite is now ready, so we're opening it up as an alpha. You can try it while we find and fix the first round of issues.

If you've used v1, the basic API syntax should still feel familiar. If you haven't (or if you tried it but it didn't click), this is a great time to take another look. v2 brings faster runtime performance, safer types, and redesigned APIs for the parts of v1 that caused the most friction.

## Validators rework

In v1, validators lived in an object keyed by the event that ran them. This worked for simple cases, but became awkward when one validator needed multiple triggers or multiple validators needed the same trigger.

v2 uses a pipeline instead. Each validator gets its own entry and declares the events that trigger it.

### One validator, multiple triggers

#### Before (v1)

Say you want to validate a field when its value changes and when it loses focus. v1 couldn't attach one validator to both events directly, so you had to add the same validator twice.

Because v1 registered the validator once for each event, it could produce duplicate errors. Your app then had to remove those duplicates before showing them in the UI.

```ts title="v1"
const form = useForm({
  defaultValues: { name: '' },
  validators: {
    onChange: mySchema,
    onBlur: mySchema,
  },
})
```

#### After (v2)

In v2, you define the validator once and list both events in `triggers`. It can run on change and blur without duplicating its setup or its errors.

```ts title="v2"
const form = useForm({
  defaultValues: { name: '' },
  validators: [
    {
      run: mySchema,
      triggers: ['change', 'blur'],
    },
  ],
})
```

### Multiple validators, one trigger

#### Before (v1)

The opposite was awkward too. Say you want to run both a schema validator and a reserved-username check whenever a field changes. v1 only had one `onChange` key, so you had to wrap both validators in a single callback and control how they ran yourself:

```ts title="v1"
const form = useForm({
  defaultValues: { name: '' },
  validators: {
    onChange: ({ formApi, value }) => {
      const errors = formApi.parseValuesWithSchema(mySchema)

      // Stop if the schema validator found any errors.
      if (errors) return errors

      return checkReservedUsername(value)
    },
  },
})
```

#### After (v2)

In v2, the two validators stay separate even though they share a trigger. Setting `bailIfInvalid` on the username check makes it run only if the schema validator passes, just like the early return in the v1 example.

```ts title="v2"
const form = useForm({
  defaultValues: { name: '' },
  validators: [
    {
      run: mySchema,
      triggers: ['change'],
    },
    {
      run: ({ value }) => checkReservedUsername(value),
      triggers: ['change'],
      // Only run this check if the schema validator passes.
      bailIfInvalid: true,
    },
  ],
})
```

### Conditional validators

Sometimes you only want an event to trigger validation after something else has happened. One common React Hook Form pattern is to validate on submit first, then validate on every change after the first submission attempt.

#### Before (v1)

In v1, general conditions had to live inside the validator. The function still ran on every change, only to return early while the condition was false. For this particular submit-then-change pattern, v1 also offered `onDynamic` together with `revalidateLogic()`:

```ts title="v1"
const form = useForm({
  defaultValues: { name: '' },
  validationLogic: revalidateLogic(),
  validators: {
    onDynamic: mySchema,
  },
})
```

#### After (v2)

In v2, each trigger can include a `when` condition. The validator still runs on submit, but the change trigger only becomes active after the first submission attempt. Until then, changes don't call the validator at all. The condition now sits next to the trigger it controls, with no early return inside the validator or separate validation setting.

```ts title="v2"
const form = useForm({
  defaultValues: { name: '' },
  validators: [
    {
      run: schema,
      triggers: [
        {
          trigger: 'change',
          // After the first submission attempt, validate every change.
          when: ({ formApi }) => formApi.state.submissionAttempts > 0,
        },
      ],
    },
  ],
})
```

## Listeners rework

Listeners used the same event-keyed model as validators in v1, so they inherited the same limitations. A listener couldn't respond to multiple events without being registered more than once, only one listener could be attached to each event, and conditional behavior had to live inside the callback.

v2 moves listeners to the same pipeline model as validators. A listener can declare multiple triggers, several listeners can share a trigger, and a `when` condition can prevent a listener from being called until it applies. This gives both APIs the same flexibility without repeating the validator examples above.

## Schema-oriented forms

v1's `formOptions` inferred its types from `defaultValues` and then checked validators against them. That works when both describe exactly the same type, but a form's initial state doesn't always satisfy its final schema.

Consider an appointment form. Its schema requires a date, but we don't want to preselect one for the user, so the form starts with `null`:

```ts
const schema = z.object({
  appointment: z.date(),
})

/*
  z.input<typeof schema> = {
     appointment: Date
  }
*/
```

The default `formOptions()` mode preserves the v1 behavior: `defaultValues` drives inference, so the mismatch appears on `validators[0].run`. `formOptions.strictSchema` makes the schema the single source of truth instead, moving the error to `appointment: null` while keeping the schema's `Date` input unchanged.

`formOptions.looseSchema` also uses the schema as its source of truth, but allows `null` and `undefined` where they appear in the defaults. The example therefore has no error and infers `appointment` as `Date | null`. When a default already matches the schema, loose mode leaves that schema type unchanged.

<!-- ::start:tabs variant="files" -->

```ts title="Base call"
const formOpts = formOptions({
  defaultValues: {
    appointment: null,
  },
  validators: [
    {
      // Error: The form is `appointment: null`, but the schema expects `Date`.
      run: schema,
      triggers: ['change'],
    },
  ],
})
```

```ts title="Strict schema"
const formOpts = formOptions.strictSchema({
  defaultValues: {
    // Error: `null` is not assignable to `Date`.
    appointment: null,
  },
  validators: [
    {
      run: schema,
      triggers: ['change'],
    },
  ],
})
```

```ts title="Loose schema"
const formOpts = formOptions.looseSchema({
  defaultValues: {
    // No error: loose mode allows null.
    appointment: null,
  },
  validators: [
    {
      run: schema,
      triggers: ['change'],
    },
  ],
})
```

<!-- ::end:tabs -->

## Form Composition type safety

#### Before (v1)

Form composition made it possible to bundle reusable components with a field and reduced the boilerplate needed to build forms. In v1, however, those components weren't restricted by the field's value type. A string field such as `email` could render a `NumberInput` without any warning about the mismatch:

```tsx title="v1"
<form.AppField name="email">
  {(field) => (
    <field.Wrapper>
      <field.Label>Email</field.Label>
      {/* No type error: NumberInput is available on a string field. */}
      <field.NumberInput />
      <field.Error />
    </field.Wrapper>
  )}
</form.AppField>
```

#### After (v2)

v2 lets composed field components be branded with the value types they support. Once `email` is inferred as a string field, incompatible components are left out of its field API. Trying to access `field.NumberInput` therefore produces a type error before the form reaches the browser.

Branding is optional for each component. When a component is branded, its constraint can accept the specified type and any narrower type, or require that exact type and nothing else. An `Error` component doesn't need to depend on the field's value type, so it can remain available to every field. This lets you decide both which composed components are constrained and how strict each constraint should be.

```tsx title="v2"
<form.Field name="email">
  {(field) => (
    <field.Wrapper>
      <field.Label>Email</field.Label>
      {/* Type error: NumberInput isn't available on a string field. */}
      <field.NumberInput />
      <field.Error />
    </field.Wrapper>
  )}
</form.Field>
```

## SSR improvements

SSR support has two sides: validating the submission on the server and returning that result to the client-side form. In v2, both sides can share the same form options.

### Before (v1)

v1 configured server validation separately from the shared form options. Validation failures were thrown as `ServerValidateError`, and checking for that error lost the inferred type of the returned form state. The client also had to merge that state back into the form with `useTransform` and `mergeForm`.

<!-- ::start:tabs variant="files" -->

```ts title="shared-code.ts"
import { formOptions } from '@tanstack/react-form-nextjs'

export const formOpts = formOptions({
  defaultValues: { age: 0 },
})
```

```ts title="action.ts"
'use server'

import {
  createServerValidate,
  ServerValidateError,
} from '@tanstack/react-form-nextjs'
import { formOpts } from './shared-code'

const mySchema = z.object({
  age: z.coerce.number().min(13, 'You must be 13 at least 13'),
})

const serverValidate = createServerValidate({
  ...formOpts,
  onServerValidate: mySchema,
})

export async function submit(_previous: unknown, formData: FormData) {
  try {
    const values = await serverValidate(formData)

    // Use values...
  } catch (error) {
    // The returned form state loses its inferred type after this check.
    if (error instanceof ServerValidateError) {
      return error.formState
    }

    throw error
  }
}
```

```tsx title="client.tsx"
'use client'

import { useActionState } from 'react'
import {
  initialFormState,
  mergeForm,
  useForm,
  useTransform,
} from '@tanstack/react-form-nextjs'
import { submit } from './action'
import { formOpts } from './shared-code'

export function Form() {
  const [state, action] = useActionState(submit, initialFormState)

  const form = useForm({
    ...formOpts,
    transform: useTransform((baseForm) => mergeForm(baseForm, state!), [state]),
  })

  return <form action={action as never}>{/* form.Field components */}</form>
}
```

<!-- ::end:tabs -->

### After (v2)

v2 moves the server validator into the shared `formOpts`, so the same configuration drives both sides. Instead of throwing for validation failures, `serverValidate` returns a result that the action can narrow through `success` without losing the types inferred from `formOpts`. The client then passes the returned `serverState` directly to `useForm`, removing the manual merge required in v1.

<!-- ::start:tabs variant="files" -->

```ts title="shared-code.ts"
import { formOptions } from '@tanstack/react-form'

const mySchema = z.object({
  age: z.coerce.number().min(13, 'You must be 13 at least 13'),
})

export const formOpts = formOptions({
  defaultValues: { age: 0 },
  validators: [
    {
      triggers: ['server'],
      runOnSubmit: false,
      run: mySchema,
    },
  ],
})
```

```ts title="action.ts"
'use server'

import {
  initialServerFormState,
  serverValidateHelper,
} from '@tanstack/react-form'
import { next } from '@tanstack/react-form-nextjs'
import { formOpts } from './shared-code'

const { createServerValidate } = serverValidateHelper({
  framework: next(),
})

const serverValidate = createServerValidate(formOpts)

export async function submit(_previous: unknown, formData: FormData) {
  const result = await serverValidate(formData)

  // serverState keeps the type inferred from formOpts.
  if (!result.success) return result.serverState

  // Use result.values...
  return initialServerFormState
}
```

```tsx title="client.tsx"
'use client'

import { useActionState } from 'react'
import { initialServerFormState, useForm } from '@tanstack/react-form'
import { submit } from './action'
import { formOpts } from './shared-code'

export function Form() {
  const [serverState, action] = useActionState(submit, initialServerFormState)

  const form = useForm({
    ...formOpts,
    serverState,
  })

  return <form action={action}>{/* form.Field components */}</form>
}
```

<!-- ::end:tabs -->

## What's missing in v2

The v2 alpha does not yet include:

- **Built-in form persistence.** The alpha does not yet provide a built-in way to save form state and restore it later, so persistence still needs to be handled outside the form API.
- **Form Composition outside of React.** We migrated other adapters, such as Vue, Solid, Angular and Lit to v2, but we want to iron out the first wave of issues before porting form composition to them.
- **Submit meta.** v1 lets you pass additional typed data from `handleSubmit` to `onSubmit`, which is useful when the same form has multiple submit actions. That API is not part of v2 yet.

## Trying out TanStack Form v2 alpha

This alpha focuses on React, since it's our most popular adapter for the library. Once we have the main issues patched, we'll focus on porting the API to the remaining supported adapters.

You can read up on the [migration guide](/form/alpha/docs/migrate-from-v1) to get started.

Additionally, we have two RFCs that we'd like to tackle for alpha development. You can find them in the pinned GitHub Issues tab:

- [#2296: What should happen when `Field` and `FormGroup` unmount? ](https://github.com/TanStack/form/issues/2296)
- [#1823: Handling array methods called on `null` or `undefined`](https://github.com/TanStack/form/issues/1823)

## Thank you

A huge thank you to everyone who’s used TanStack Form, shared feedback, reported issues, or simply told us what’s working and what isn’t. Your input has genuinely helped shape this rewrite, and we’re incredibly grateful to have you along for the ride.

We’re excited to finally get the v2 alpha into your hands, and we’d love to hear what you think as you start trying it out.

~ The TanStack Form team ❤️
