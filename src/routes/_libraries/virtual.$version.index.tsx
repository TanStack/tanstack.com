import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
import { MaintainersSection } from '~/components/MaintainersSection'
import { LibraryTestimonials } from '~/components/LibraryTestimonials'
import { ossStatsQuery } from '~/queries/stats'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { CodeExampleCard } from '~/components/CodeExampleCard'

const library = getLibrary('virtual')

export const Route = createFileRoute('/_libraries/virtual/$version/')({
  component: VirtualVersionIndex,
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

const codeExamples: Partial<Record<Framework, { lang: string; code: string }>> =
  {
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

function VirtualVersionIndex() {
  const { version } = Route.useParams()
  const [framework, setFramework] = useState<Framework>('react')
  const branch = getBranch(virtualProject, version)

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={virtualProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className:
            'bg-purple-500 border-purple-500 hover:bg-purple-600 text-white',
        }}
      />

      <LibraryStatsSection library={library} />

      <CodeExampleCard
        frameworks={virtualProject.frameworks}
        codeByFramework={codeExamples}
      />

      <LibraryFeatureHighlights
        featureHighlights={virtualProject.featureHighlights}
      />

      <LibraryTestimonials testimonials={virtualProject.testimonials} />

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
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4 mx-auto"
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Take it for a spin!</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            With just a few divs and some inline styles, you're already well on
            your way to creating an extremely powerful virtualization
            experience.
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl">
          <FrameworkIconTabs
            frameworks={virtualProject.frameworks}
            value={framework}
            onChange={setFramework}
          />
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

      <MaintainersSection libraryId="virtual" />
      <PartnersSection libraryId="virtual" />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-purple-500 border-purple-500 hover:bg-purple-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
