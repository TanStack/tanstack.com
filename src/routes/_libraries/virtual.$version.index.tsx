import * as React from 'react'

import { virtualProject } from '~/libraries/virtual'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { Framework, getBranch } from '~/libraries'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'
import { CodeBlock } from '~/components/Markdown'
import { Link, createFileRoute } from '@tanstack/react-router'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('virtual')

export const Route = createFileRoute('/_libraries/virtual/$version/')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: virtualProject.name,
      description: virtualProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function RouteComp() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const [framework, setFramework] = React.useState<Framework>('react')
  const branch = getBranch(virtualProject, version)
  const [isDark] = React.useState(true)

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={virtualProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className: 'bg-purple-500 text-white',
        }}
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

      {/* Minimal code example card */}
      <div className="px-4 space-y-4 flex flex-col items-center ">
        <div className="text-3xl font-black">Just a quick look...</div>
        <div className="relative group bg-white/50 dark:bg-black/40 rounded-lg overflow-hidden shadow-xl max-w-full mx-auto [&_pre]:bg-transparent! [&_pre]:p-4!">
          <div>
            <FrameworkIconTabs
              frameworks={virtualProject.frameworks}
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
                code: `import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: 1000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,
})
// Map virtual rows to your UI`,
              },
              solid: {
                lang: 'tsx',
                code: `import { createVirtualizer } from '@tanstack/solid-virtual'

const parentRef: HTMLElement | undefined = undefined

const rowVirtualizer = createVirtualizer({
  count: 1000,
  getScrollElement: () => parentRef!,
  estimateSize: () => 36,
})
// Map rowVirtualizer.getVirtualItems() to your UI`,
              },
              vue: {
                lang: 'vue',
                code: `<script setup lang="ts">
import { ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

const parentRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: 1000,
  getScrollElement: () => parentRef.value!,
  estimateSize: () => 36,
})
</script>

<template>
  <div ref="parentRef" style="overflow: auto; height: 300px">
    <!-- Render rowVirtualizer.getVirtualItems() -->
  </div>
</template>`,
              },
              svelte: {
                lang: 'svelte',
                code: `<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual'
  let parentRef: HTMLDivElement
  const rowVirtualizer = createVirtualizer({
    count: 1000,
    getScrollElement: () => parentRef,
    estimateSize: () => 36,
  })
</script>

<div bind:this={parentRef} style="overflow:auto; height:300px">
  <!-- Render $rowVirtualizer.getVirtualItems() -->
</div>`,
              },
              angular: {
                lang: 'ts',
                code: `import { Component, ElementRef, viewChild } from '@angular/core'
import { createAngularVirtualizer } from '@tanstack/angular-virtual'

@Component({
  standalone: true,
  selector: 'virtual-list',
  template: '<div #parent style="overflow:auto; height:300px"></div>',
})
export class VirtualListComponent {
  parent = viewChild.required<ElementRef<HTMLDivElement>>('parent')
  virtualizer = createAngularVirtualizer(() => ({
    count: 1000,
    getScrollElement: () => this.parent().nativeElement,
    estimateSize: () => 36,
  }))
}`,
              },
              lit: {
                lang: 'ts',
                code: `import { LitElement, customElement, html } from 'lit'
import { createLitVirtualizer } from '@tanstack/lit-virtual'

@customElement('virtual-list')
export class VirtualList extends LitElement {
  private parent?: HTMLDivElement
  virtualizer = createLitVirtualizer({
    count: 1000,
    getScrollElement: () => this.parent!,
    estimateSize: () => 36,
  })

  render() {
    return html\`<div style="overflow:auto; height:300px"></div>\`
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
          className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-purple-500 text-white"
        >
          Get Started
        </Link>
      </div>

      <LibraryFeatureHighlights featureHighlights={library.featureHighlights} />

      <FeatureGrid
        title="Framework Agnostic & Feature Rich"
        items={[
          'Lightweight (10 - 15kb)',
          'Tree-Shaking',
          'Headless',
          'Vertical/Column Virtualization',
          'Horizontal/Row Virtualization',
          'Grid Virtualization',
          'Window-Scrolling',
          'Fixed Sizing',
          'Variable Sizing',
          'Dynamic/Measured Sizing',
          'Scrolling Utilities',
          'Sticky Items',
        ]}
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4  mx-auto"
      />

      {/* <div>
        <div className="uppercase tracking-wider text-sm font-semibold text-center text-gray-400 mb-3">
          Trusted in Production by
        </div>
        <marquee scrollamount="2">
          <div className="flex gap-2 items-center text-3xl font-bold ml-[-100%]">
            {(new Array(4) as string[])
              .fill('')
              .reduce(
                (all) => [...all, ...all],
                [
                  'Intuit',
                  'Google',
                  'Amazon',
                  'Apple',
                  'AutoZone',
                  'Microsoft',
                  'Cisco',
                  'Uber',
                  'Salesforce',
                  'Walmart',
                  'Wix',
                  'HP',
                  'Docusign',
                  'Tripwire',
                  'Yahoo!',
                  'Ocado',
                  'Nordstrom',
                  'TicketMaster',
                  'Comcast Business',
                  'Nozzle.io',
                ]
              )
              .map((d, i) => (
                <span key={i} className="opacity-70 even:opacity-40">
                  {d}
                </span>
              ))}
          </div>
        </marquee>
      </div> */}

      <PartnersSection libraryId="virtual" />

      <LazySponsorSection />

      <LandingPageGad />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full bg-white/50 dark:bg-black/50 rounded-lg overflow-hidden shadow-xl">
          <div className="">
            <FrameworkIconTabs
              frameworks={virtualProject.frameworks}
              value={framework}
              onChange={setFramework}
            />
          </div>
          {['vue', 'solid', 'svelte'].includes(framework) ? (
            <div className="p-6 text-center text-lg w-full bg-black text-white">
              Looking for the <strong>@tanstack/{framework}-virtual</strong>{' '}
              example? We could use your help to build the{' '}
              <strong>@tanstack/{framework}-virtual</strong> adapter! Join the{' '}
              <a
                href="https://tlinz.com/discord"
                className="text-teal-500 font-bold"
              >
                TanStack Discord Server
              </a>{' '}
              and let's get to work!
            </div>
          ) : (
            <StackBlitzEmbed
              repo={virtualProject.repo}
              branch={branch}
              examplePath={`examples/${framework}/fixed`}
              title="tannerlinsley/react-virtual: fixed"
            />
          )}
        </div>
      </div>

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-purple-500 text-white"
      />
      <Footer />
    </div>
  )
}
