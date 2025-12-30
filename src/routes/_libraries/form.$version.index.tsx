import * as React from 'react'

import { Footer } from '~/components/Footer'
import { formProject } from '~/libraries/form'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
import { CodeBlock } from '~/components/Markdown'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import { Link, createFileRoute } from '@tanstack/react-router'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'

const library = getLibrary('form')

export const Route = createFileRoute('/_libraries/form/$version/')({
  component: FormVersionIndex,
  head: () => ({
    meta: seo({
      title: formProject.name,
      description: formProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function FormVersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const branch = getBranch(formProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <LibraryHero
          project={formProject}
          cta={{
            linkProps: {
              to: '/$libraryId/$version/docs',
              params: { libraryId: library.id, version },
            },
            label: 'Get Started',
            className: 'bg-yellow-400 text-black',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>
        <AdGate>
          <GamHeader />
        </AdGate>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <LibraryTestimonials testimonials={formProject.testimonials} />

        {/* Minimal code example card */}
        <div className="px-4 space-y-4 flex flex-col items-center ">
          <div className="text-3xl font-black">Just a quick look...</div>
          <div className="relative group bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl max-w-full mx-auto [&_pre]:bg-transparent! [&_pre]:p-4!">
            <div>
              <FrameworkIconTabs
                frameworks={formProject.frameworks}
                value={framework}
                onChange={setFramework}
              />
            </div>
            {(() => {
              const codeByFramework: Partial<
                Record<Framework, { lang: string; code: string }>
              > = {
                react: {
                  lang: 'tsx',
                  code: `import { useForm } from '@tanstack/react-form'

const form = useForm({
  defaultValues: { name: '' },
  onSubmit: async ({ value }) => console.log(value),
})
// Bind inputs to form.state and form.handleSubmit`,
                },
                vue: {
                  lang: 'vue',
                  code: `<script setup lang="ts">
import { useForm } from '@tanstack/vue-form'

const form = useForm({
  defaultValues: { name: '' },
  onSubmit: async ({ value }) => console.log(value),
})
</script>

<template>
  <form @submit.prevent="form.handleSubmit">
    <input v-model="form.state.values.name" />
    <button type="submit">Submit</button>
  </form>
</template>`,
                },
                angular: {
                  lang: 'ts',
                  code: `import { Component } from '@angular/core'
import { createAngularForm } from '@tanstack/angular-form'

@Component({
  standalone: true,
  selector: 'app-form',
  template: '<form (submit)="form.handleSubmit($event)"><input [value]="form.state().values.name" (input)="form.setFieldValue(\"name\", $any($event.target).value)" /><button type="submit">Submit</button></form>',
})
export class AppComponent {
  form = createAngularForm(() => ({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => console.log(value),
  }))
}`,
                },
                solid: {
                  lang: 'tsx',
                  code: `import { createForm } from '@tanstack/solid-form'

export default function SimpleForm() {
  const form = createForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => console.log(value),
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <input value={form.state.values.name} onInput={(e) => form.setFieldValue('name', e.currentTarget.value)} />
      <button type="submit">Submit</button>
    </form>
  )
}`,
                },
                svelte: {
                  lang: 'svelte',
                  code: `<script lang="ts">
  import { createForm } from '@tanstack/svelte-form'
  const form = createForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => console.log(value),
  })
</script>

<form on:submit|preventDefault={form.handleSubmit}>
  <input bind:value={form.state.values.name} />
  <button type="submit">Submit</button>
</form>`,
                },
                lit: {
                  lang: 'ts',
                  code: `import { LitElement, customElement, html } from 'lit'
import { createLitForm } from '@tanstack/lit-form'

@customElement('simple-form')
export class SimpleForm extends LitElement {
  form = createLitForm({
    defaultValues: { name: '' },
    onSubmit: async ({ value }) => console.log(value),
  })

  override render() {
    return html\`<form @submit=\${(e: Event) => { e.preventDefault(); this.form.handleSubmit(e); }}>
      <input .value=\${this.form.state.values.name} @input=\${(e: any) => this.form.setFieldValue('name', e.target.value)} />
      <button type="submit">Submit</button>
    </form>\`
  }
}`,
                },
              }

              const selected =
                codeByFramework[framework] || codeByFramework.react!

              return (
                <>
                  <CodeBlock
                    className="mt-0 border-0"
                    showTypeCopyButton={false as any}
                  >
                    <code className={`language-${selected.lang}`}>
                      {selected.code}
                    </code>
                  </CodeBlock>
                </>
              )
            })()}
          </div>
          <Link
            to="/$libraryId/$version/docs"
            params={{ libraryId: library.id, version }}
            className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-yellow-500 text-black"
          >
            Get Started
          </Link>
        </div>

        <FeatureGrid
          title="No dependencies. All the Features."
          items={[
            'Framework agnostic design',
            'First Class TypeScript Support',
            'Headless',
            'Tiny / Zero Deps',
            'Granularly Reactive Components/Hooks',
            'Extensibility and plugin architecture',
            'Modular architecture',
            'Form/Field validation',
            'Async Validation',
            'Built-in Async Validation Debouncing',
            'Configurable Validation Events',
            'Deeply Nested Object/Array Fields',
          ]}
        />

        <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
            <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Less code, fewer edge cases.
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              Instead of encouraging hasty abstractions and hook-focused APIs,
              TanStack Form embraces composition where it counts by giving you
              headless APIs via components (and hooks if you want them of
              course). TanStack Form is designed to be used directly in your
              components and UI. This means less code, fewer edge cases, and
              deeper control over your UI. Try it out with one of the examples
              below!
            </p>
          </div>
        </div>

        <div className="px-4">
          <div className="relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl">
            <div className="">
              <FrameworkIconTabs
                frameworks={formProject.frameworks}
                value={framework}
                onChange={setFramework}
              />
            </div>
            <StackBlitzEmbed
              repo={formProject.repo}
              branch={branch}
              examplePath={`examples/${framework}/simple`}
              title={`tanstack//${framework}-form: simple`}
            />
          </div>
        </div>

        <PartnersSection libraryId="form" />

        <LazySponsorSection />

        <LandingPageGad />

        <BottomCTA
          linkProps={{
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          }}
          label="Get Started!"
          className="bg-yellow-500 text-black"
        />
        <Footer />
      </div>
    </>
  )
}
