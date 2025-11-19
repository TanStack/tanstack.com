import * as React from 'react'
import { tableProject } from '~/libraries/table'
import { Footer } from '~/components/Footer'
import { LibraryHero } from '~/components/LibraryHero'
import { FeatureGrid } from '~/components/FeatureGrid'
import { TrustedByMarquee } from '~/components/TrustedByMarquee'
import { PartnersSection } from '~/components/PartnersSection'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { CodeBlock } from '~/components/Markdown'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BottomCTA } from '~/components/BottomCTA'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { getExampleStartingPath } from '~/utils/sandbox'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('table')

export const Route = createFileRoute('/_libraries/table/$version/')({
  component: TableVersionIndex,
  head: () => ({
    meta: seo({
      title: tableProject.name,
      description: tableProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function TableVersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const branch = getBranch(tableProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')
  const sandboxFirstFileName = getExampleStartingPath(framework)

  return (
    <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
      <LibraryHero
        project={tableProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className: 'bg-blue-500 text-white',
        }}
      />

      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

      {/* Minimal code example card */}
      <div className="px-4 space-y-4 flex flex-col items-center w">
        <div className="text-3xl font-black">Just a quick look...</div>
        <div className="group relative bg-white/50 dark:bg-black/40 rounded-lg overflow-hidden shadow-xl max-w-full mx-auto [&_pre]:bg-transparent! [&_pre]:p-4!">
          <FrameworkIconTabs
            frameworks={tableProject.frameworks}
            value={framework}
            onChange={setFramework}
          />
          {(() => {
            const codeByFramework: Partial<
              Record<Framework, { lang: string; code: string }>
            > = {
              react: {
                lang: 'tsx',
                code: `import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]

export default function SimpleTable() {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}`,
              },
              angular: {
                lang: 'ts',
                code: `import { Component, signal } from '@angular/core'
import { createAngularTable, getCoreRowModel, FlexRenderDirective, type ColumnDef } from '@tanstack/angular-table'

type Person = { id: number; name: string }

@Component({
  standalone: true,
  selector: 'app-table',
  imports: [FlexRenderDirective],
  template: \`
<table>
  <thead>
    @for (hg of table.getHeaderGroups(); track hg.id) {
      <tr>
        @for (header of hg.headers; track header.id) {
          <th>
            <ng-container *flexRender="header.column.columnDef.header; props: header.getContext()"></ng-container>
          </th>
        }
      </tr>
    }
  </thead>
  <tbody>
    @for (row of table.getRowModel().rows; track row.id) {
      <tr>
        @for (cell of row.getVisibleCells(); track cell.id) {
          <td>
            <ng-container *flexRender="cell.column.columnDef.cell; props: cell.getContext()"></ng-container>
          </td>
        }
      </tr>
    }
  </tbody>
</table>
  \`,
})
export class AppComponent {
  data = signal<Person[]>([{ id: 1, name: 'Ada' }])

  columns: ColumnDef<Person>[] = [
    { accessorKey: 'name', header: 'Name' },
  ]

  table = createAngularTable(() => ({
    data: this.data(),
    columns: this.columns,
    getCoreRowModel: getCoreRowModel(),
  }))
}`,
              },
              solid: {
                lang: 'tsx',
                code: `import { createSolidTable, getCoreRowModel, flexRender } from '@tanstack/solid-table'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]

export default function SimpleTable() {
  const table = createSolidTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr>
            {hg.headers.map((header) => (
              <th>{flexRender(header.column.columnDef.header, header.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr>
            {row.getVisibleCells().map((cell) => (
              <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}`,
              },
              vue: {
                lang: 'vue',
                code: `<script setup lang="ts">
import { useVueTable, getCoreRowModel, flexRender } from '@tanstack/vue-table'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]
const table = useVueTable({ data, columns, getCoreRowModel: getCoreRowModel() })
</script>

<template>
  <table>
    <thead>
      <tr v-for="hg in table.getHeaderGroups()" :key="hg.id">
        <th v-for="header in hg.headers" :key="header.id">
          {{ flexRender(header.column.columnDef.header, header.getContext()) }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in table.getRowModel().rows" :key="row.id">
        <td v-for="cell in row.getVisibleCells()" :key="cell.id">
          {{ flexRender(cell.column.columnDef.cell, cell.getContext()) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>`,
              },
              svelte: {
                lang: 'svelte',
                code: `<script lang="ts">
  import { createSvelteTable, getCoreRowModel, flexRender } from '@tanstack/svelte-table'
  const data = [{ id: 1, name: 'Ada' }]
  const columns = [{ accessorKey: 'name', header: 'Name' }]
  const table = createSvelteTable({ data, columns, getCoreRowModel: getCoreRowModel() })
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as hg}
      <tr>
        {#each hg.headers as header}
          <th>{flexRender(header.column.columnDef.header, header.getContext())}</th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each table.getRowModel().rows as row}
      <tr>
        {#each row.getVisibleCells() as cell}
          <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>`,
              },
              lit: {
                lang: 'ts',
                code: `import { LitElement, customElement, html } from 'lit'
import { createLitTable, getCoreRowModel, flexRender } from '@tanstack/lit-table'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]

@customElement('simple-table')
export class SimpleTable extends LitElement {
  table = createLitTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  render() {
    return html\`<table>
      <thead>
        \${this.table.getHeaderGroups().map((hg) => html\`<tr>
          \${hg.headers.map((header) => html\`<th>\${flexRender(header.column.columnDef.header, header.getContext())}</th>\`)}
        </tr>\`)}
      </thead>
      <tbody>
        \${this.table.getRowModel().rows.map((row) => html\`<tr>
          \${row.getVisibleCells().map((cell) => html\`<td>\${flexRender(cell.column.columnDef.cell, cell.getContext())}</td>\`)}
        </tr>\`)}
      </tbody>
    </table>\`
  }
}`,
              },
              qwik: {
                lang: 'tsx',
                code: `import { component$ } from '@builder.io/qwik'
import { createQwikTable, getCoreRowModel, flexRender } from '@tanstack/qwik-table'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]

export default component$(() => {
  const table = createQwikTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr>
            {hg.headers.map((header) => (
              <th>{flexRender(header.column.columnDef.header, header.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr>
            {row.getVisibleCells().map((cell) => (
              <td>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
})`,
              },
              vanilla: {
                lang: 'ts',
                code: `import { createTable, getCoreRowModel, flexRender } from '@tanstack/table-core'

const data = [{ id: 1, name: 'Ada' }]
const columns = [{ accessorKey: 'name', header: 'Name' }]

const table = createTable({ data, columns, getCoreRowModel: getCoreRowModel() })

const thead = document.querySelector('thead')!
table.getHeaderGroups().forEach((hg) => {
  const tr = document.createElement('tr')
  hg.headers.forEach((header) => {
    const th = document.createElement('th')
    th.textContent = String(flexRender(header.column.columnDef.header, header.getContext()))
    tr.appendChild(th)
  })
  thead.appendChild(tr)
})

const tbody = document.querySelector('tbody')!
table.getRowModel().rows.forEach((row) => {
  const tr = document.createElement('tr')
  row.getVisibleCells().forEach((cell) => {
    const td = document.createElement('td')
    td.textContent = String(flexRender(cell.column.columnDef.cell, cell.getContext()))
    tr.appendChild(td)
  })
  tbody.appendChild(tr)
})`,
              },
            }

            const selected = codeByFramework[framework]

            if (!selected) {
              return (
                <div className="p-6 text-center text-lg w-full bg-black/80 text-white">
                  Looking for the <strong>@tanstack/{framework}-table</strong>{' '}
                  example? We could use your help to build the{' '}
                  <strong>@tanstack/{framework}-table</strong> adapter! Join the{' '}
                  <a
                    href="https://tlinz.com/discord"
                    className="text-teal-400 font-bold underline"
                  >
                    TanStack Discord Server
                  </a>{' '}
                  and let's get to work!
                </div>
              )
            }

            return (
              <CodeBlock
                className="mt-0 border-0"
                showTypeCopyButton={false as any}
              >
                <code className={`language-${selected.lang}`}>
                  {selected.code}
                </code>
              </CodeBlock>
            )
          })()}
        </div>
        <Link
          to="/$libraryId/$version/docs"
          params={{ libraryId: library.id, version }}
          className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-blue-500 text-white"
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
          'Cell Formatters',
          'Auto-managed internal state',
          'Opt-in fully controlled state',
          'Sorting',
          'Multi Sort',
          'Global Filters',
          'Columns Filters',
          'Pagination',
          'Row Grouping',
          'Aggregation',
          'Row Selection',
          'Row Expansion',
          'Column Ordering',
          'Column Visibility',
          'Column Resizing',
          'Virtualizable',
          'Server-side/external Data',
          'Nested/Grouped Headers',
          'Footers',
        ]}
        gridClassName="grid grid-flow-row grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-4  mx-auto"
      />

      <TrustedByMarquee
        brands={[
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
        ]}
      />

      <PartnersSection libraryId="table" />

      <LazySponsorSection />

      <LandingPageGad />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
          <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
            Take it for a spin!
          </h3>
          <p className="my-4 text-xl leading-7  text-gray-600">
            With some basic styles, some table markup and few columns, you're
            already well on your way to creating a drop-dead powerful table.
          </p>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full bg-white/50 dark:bg-black/50 rounded-lg overflow-hidden shadow-xl">
          <div className="">
            <FrameworkIconTabs
              frameworks={tableProject.frameworks}
              value={framework}
              onChange={setFramework}
            />
          </div>
          <StackBlitzEmbed
            repo={tableProject.repo}
            branch={branch}
            examplePath={`examples/${framework}/basic`}
            file={sandboxFirstFileName}
            title="tannerlinsley/react-table: basic"
          />
        </div>
      </div>

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-teal-500 text-white"
      />
      <Footer />
    </div>
  )
}
