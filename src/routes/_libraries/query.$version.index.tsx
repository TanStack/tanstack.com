import * as React from 'react'

import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { PartnersSection } from '~/components/PartnersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
// import { QueryGGBanner } from '~/components/QueryGGBanner'
import { QueryGGBannerSale } from '~/components/QueryGGBannerSale'
import { queryProject } from '~/libraries/query'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'
import { CodeBlock } from '~/components/Markdown'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { Link, createFileRoute } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'

const library = getLibrary('query')

export const Route = createFileRoute('/_libraries/query/$version/')({
  component: VersionIndex,
  head: () => ({
    meta: seo({
      title: queryProject.name,
      description: queryProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function VersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const branch = getBranch(queryProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')

  return (
    <div className="flex flex-1 flex-col min-h-0 relative overflow-x-hidden">
      <div className="flex flex-1 min-h-0 relative justify-center overflow-x-hidden">
        <div className="flex flex-col gap-20 md:gap-32 max-w-full py-32">
          <LibraryHero
            project={queryProject}
            cta={{
              linkProps: {
                to: '/$libraryId/$version/docs',
                params: { libraryId: library.id, version },
              },
              label: 'Read the Docs',
              className: 'bg-red-500 text-white',
            }}
          />
          <div className="px-4">
            {/* <QueryGGBanner /> */}
            <QueryGGBannerSale />
          </div>

          <div className="w-fit mx-auto px-4">
            <OpenSourceStats library={library} />
          </div>
          <AdGate>
            <GamHeader />
          </AdGate>
          {/* Minimal code example card */}
          <div className="px-4 space-y-4 flex flex-col items-center ">
            <div className="text-3xl font-black">Just a quick look...</div>
            <div
              className={twMerge(
                `group bg-white/60 dark:bg-black/40 rounded-lg overflow-hidden shadow-xl
            max-w-full mx-auto
            [&_pre]:bg-transparent! [&_pre]:p-4!`
              )}
            >
              <div>
                <FrameworkIconTabs
                  frameworks={queryProject.frameworks}
                  value={framework}
                  onChange={setFramework}
                />
                {(() => {
                  const codeByFramework: Partial<
                    Record<Framework, { lang: string; code: string }>
                  > = {
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

                  const selected =
                    codeByFramework[framework] || codeByFramework.react!

                  return (
                    <CodeBlock
                      className="mt-0 border-0"
                      showTypeCopyButton={false}
                    >
                      <code className={`language-${selected.lang}`}>
                        {selected.code}
                      </code>
                    </CodeBlock>
                  )
                })()}
              </div>
            </div>
            <Link
              to="/$libraryId/$version/docs"
              params={{ libraryId: library.id, version }}
              className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-red-500 text-white"
            >
              Get Started
            </Link>
          </div>
          <LibraryFeatureHighlights
            featureHighlights={library.featureHighlights}
          />

          <div className="px-4 sm:px-6 lg:px-8 mx-auto">
            <div className=" sm:text-center pb-16">
              <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
                No dependencies. All the Features.
              </h3>
              <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
                With zero dependencies, TanStack Query is extremely lean given
                the dense feature set it provides. From weekend hobbies all the
                way to enterprise e-commerce systems (Yes, I'm lookin' at you
                Walmart! 😉), TanStack Query is the battle-hardened tool to help
                you succeed at the speed of your creativity.
              </p>
            </div>
            <FeatureGrid
              title="No dependencies. All the Features."
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
          </div>

          {/* Trusted Marquee intentionally left as-is for Query page content differences */}

          <PartnersSection libraryId="query" />

          <LazySponsorSection />

          <LandingPageGad />

          <div className="flex flex-col gap-4">
            <div className="px-4 sm:px-6 lg:px-8  mx-auto max-w-3xl sm:text-center">
              <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
                Less code, fewer edge cases.
              </h3>
              <p className="my-4 text-xl leading-7  text-gray-600">
                Instead of writing reducers, caching logic, timers, retry logic,
                complex async/await scripting (I could keep going...), you
                literally write a tiny fraction of the code you normally would.
                You will be surprised at how little code you're writing or how
                much code you're deleting when you use TanStack Query. Try it
                out with one of the examples below!
              </p>
            </div>
          </div>
          <div className="px-4">
            <div className="relative w-full bg-white/50 dark:bg-black/50 rounded-lg overflow-hidden shadow-xl">
              <div className="">
                <FrameworkIconTabs
                  frameworks={queryProject.frameworks}
                  value={framework}
                  onChange={setFramework}
                />
              </div>
              <StackBlitzEmbed
                repo={queryProject.repo}
                branch={branch}
                examplePath={`examples/${framework}/simple`}
                title={`tannerlinsley/${framework}-query: basic`}
              />
            </div>
          </div>

          <BottomCTA
            linkProps={{
              to: '/$libraryId/$version/docs',
              params: { libraryId: library.id, version },
            }}
            label="Read the Docs!"
            className="bg-red-500 text-white"
          />
          <Footer />
        </div>
      </div>
    </div>
  )
}
