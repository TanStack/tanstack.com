import { useParams } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { formProject } from '~/libraries/form'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LibraryShowcases } from '~/components/ShowcaseSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { CodeExampleCard } from '~/components/CodeExampleCard'
import { StackBlitzSection } from '~/components/StackBlitzSection'

const library = getLibrary('form')

const codeExamples: Partial<Record<Framework, { lang: string; code: string }>> =
  {
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
  template: '<form (submit)="form.handleSubmit($event)"><input [value]="form.state().values.name" (input)="form.setFieldValue(\\"name\\", $any($event.target).value)" /><button type="submit">Submit</button></form>',
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

export default function FormLanding() {
  const { version } = useParams({ strict: false })
  const branch = getBranch(formProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={formProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className:
            'bg-yellow-400 border-yellow-400 hover:bg-yellow-500 text-black',
        }}
      />

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={formProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={formProject.testimonials} />

      <CodeExampleCard
        frameworks={formProject.frameworks}
        codeByFramework={codeExamples}
      />

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
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Less code, fewer edge cases.</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            Instead of encouraging hasty abstractions and hook-focused APIs,
            TanStack Form embraces composition where it counts by giving you
            headless APIs via components (and hooks if you want them of course).
            TanStack Form is designed to be used directly in your components and
            UI. This means less code, fewer edge cases, and deeper control over
            your UI. Try it out with one of the examples below!
          </p>
        </div>
      </div>

      <StackBlitzSection
        project={formProject}
        branch={branch}
        examplePath="examples/${framework}/simple"
        title={(framework) => `tanstack//${framework}-form: simple`}
      />

      <MaintainersSection libraryId="form" />
      <PartnersSection libraryId="form" />

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <LibraryShowcases libraryId="form" libraryName="TanStack Form" />
      </div>

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-yellow-500 border-yellow-500 hover:bg-yellow-600 text-black"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
