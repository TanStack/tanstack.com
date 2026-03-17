import { useParams } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { QueryGGBanner } from '~/components/QueryGGBanner'
import { queryProject } from '~/libraries/query'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { LibraryShowcases } from '~/components/ShowcaseSection'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { CodeExampleCard } from '~/components/CodeExampleCard'
import { StackBlitzSection } from '~/components/StackBlitzSection'
import { FeatureGridSection } from '~/components/FeatureGridSection'

const library = getLibrary('query')

const codeExamples: Partial<Record<Framework, { lang: string; code: string }>> =
  {
    react: {
      lang: 'tsx',
      code: `import { useQuery } from '@tanstack/react-query'

function Todos() {
  const { data, isPending, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  })

  if (isPending) return <span>Loading...</span>
  if (error) return <span>Oops!</span>

  return <ul>{data.map(t => <li key={t.id}>{t.title}</li>)}</ul>
}

export default Todos`,
    },
    solid: {
      lang: 'tsx',
      code: `import { createQuery } from '@tanstack/solid-query'

function Todos() {
  const todos = createQuery(() => ({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  }))

  return <ul>{todos.data?.map((t) => <li>{t.title}</li>)}</ul>
}

export default Todos`,
    },
    preact: {
      lang: 'tsx',
      code: `import { useQuery } from '@tanstack/preact-query'

function Todos() {
  const { data, isPending, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  })

  if (isPending) return <span>Loading...</span>
  if (error) return <span>Oops!</span>

  return <ul>{data.map(t => <li key={t.id}>{t.title}</li>)}</ul>
}

export default Todos`,
    },
    vue: {
      lang: 'vue',
      code: `<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

const { data, isPending, error } = useQuery({
  queryKey: ['todos'],
  queryFn: () => fetch('/api/todos').then(r => r.json()),
})
</script>

<template>
  <ul v-if="data">
    <li v-for="t in data" :key="t.id">{{ t.title }}</li>
  </ul>
  <span v-else-if="isPending">Loading...</span>
  <span v-else>Oops!</span>
</template>`,
    },
    svelte: {
      lang: 'svelte',
      code: `<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  const todos = createQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  })
</script>

{#if $todos.isPending}
  Loading...
{:else if $todos.error}
  Oops!
{:else}
  <ul>
    {#each $todos.data as t}
      <li>{t.title}</li>
    {/each}
  </ul>
{/if}`,
    },
    angular: {
      lang: 'ts',
      code: `import { Component } from '@angular/core'
import { injectQuery } from '@tanstack/angular-query-experimental'

@Component({
  selector: 'todos',
  standalone: true,
  template: \`
    <ng-container *ngIf="todos.isPending()">
      Loading...
    </ng-container>
    <ul *ngIf="todos.data() as data">
      <li *ngFor="let t of data">
        {{ t.title }}
      </li>
    </ul>
  \`,
})
export class TodosComponent {
  todos = injectQuery(() => ({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  }))
}
`,
    },
  }

export default function QueryLanding() {
  const { version } = useParams({ strict: false })
  const branch = getBranch(queryProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={queryProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Read the Docs',
          className: 'bg-red-500 border-red-500 hover:bg-red-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <CodeExampleCard
        frameworks={queryProject.frameworks}
        codeByFramework={codeExamples}
      />

      <LibraryFeatureHighlights
        featureHighlights={queryProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={queryProject.testimonials} />

      <FeatureGridSection
        title="No dependencies. All the Features."
        description="With zero dependencies, TanStack Query is extremely lean given the dense feature set it provides. From weekend hobbies all the way to enterprise e-commerce systems (Yes, I'm lookin' at you Walmart!), TanStack Query is the battle-hardened tool to help you succeed at the speed of your creativity."
        items={[
          'Backend agnostic',
          'Dedicated Devtools',
          'Auto Caching',
          'Auto Refetching',
          'Window Focus Refetching',
          'Polling/Realtime Queries',
          'Parallel Queries',
          'Dependent Queries',
          'Mutations API',
          'Automatic Garbage Collection',
          'Paginated/Cursor Queries',
          'Load-More/Infinite Scroll Queries',
          'Scroll Recovery',
          'Request Cancellation',
          'Suspense Ready!',
          'Render-as-you-fetch',
          'Prefetching',
          'Variable-length Parallel Queries',
          'Offline Support',
          'SSR Support',
          'Data Selectors',
        ]}
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto max-w-3xl">
          <h3 className="text-3xl font-bold">Less code, fewer edge cases.</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            Instead of writing reducers, caching logic, timers, retry logic,
            complex async/await scripting (I could keep going...), you literally
            write a tiny fraction of the code you normally would. You will be
            surprised at how little code you're writing or how much code you're
            deleting when you use TanStack Query. Try it out with one of the
            examples below!
          </p>
        </div>
      </div>

      <StackBlitzSection
        project={queryProject}
        branch={branch}
        examplePath="examples/${framework}/simple"
        title={(framework) => `tannerlinsley/${framework}-query: basic`}
      />

      <MaintainersSection libraryId="query" />
      <PartnersSection libraryId="query" />

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <LibraryShowcases libraryId="query" libraryName="TanStack Query" />
      </div>

      <div className="px-4">
        <QueryGGBanner />
      </div>

      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Read the Docs!"
        className="bg-red-500 border-red-500 hover:bg-red-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
