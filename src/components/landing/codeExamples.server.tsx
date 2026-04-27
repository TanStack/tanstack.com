import * as React from 'react'
import type { LibraryId } from '~/libraries'
import { formProject } from '~/libraries/form'
import { queryProject } from '~/libraries/query'
import { routerProject } from '~/libraries/router'
import { tableProject } from '~/libraries/table'
import { virtualProject } from '~/libraries/virtual'
import {
  LandingCodeExampleCard,
  type LandingCodeExample,
} from './LandingCodeExampleCard.server'

const queryCodeExample: LandingCodeExample = {
  frameworks: queryProject.frameworks,
  codeByFramework: {
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
  template: \
\`
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
  },
}

const routerCodeExample: LandingCodeExample = {
  frameworks: routerProject.frameworks,
  codeByFramework: {
    react: {
      lang: 'tsx',
      code: `import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'

const rootRoute = createRootRoute()
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Hello World</div>,
})
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

export default function App() {
  return <RouterProvider router={router} />
}`,
    },
    solid: {
      lang: 'tsx',
      code: `import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/solid-router'

const rootRoute = createRootRoute()
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Hello World</div>,
})
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

export default function App() {
  return <RouterProvider router={router} />
}`,
    },
  },
}

const formCodeExample: LandingCodeExample = {
  frameworks: formProject.frameworks,
  codeByFramework: {
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
  },
}

const virtualCodeExample: LandingCodeExample = {
  frameworks: virtualProject.frameworks,
  codeByFramework: {
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
  },
}

const tableCodeExample: LandingCodeExample = {
  frameworks: tableProject.frameworks,
  codeByFramework: {
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
  template: \
\`
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
  },
  renderFallback: (framework) => {
    return (
      <div className="p-6 text-center text-lg w-full bg-gray-900 text-white">
        Looking for the <strong>@tanstack/{framework}-table</strong> example? We
        could use your help to build the{' '}
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
  },
}

const landingCodeExamples: Partial<Record<LibraryId, LandingCodeExample>> = {
  form: formCodeExample,
  query: queryCodeExample,
  router: routerCodeExample,
  table: tableCodeExample,
  virtual: virtualCodeExample,
}

export function getLandingCodeExample(libraryId: string) {
  return landingCodeExamples[libraryId as LibraryId] || null
}

export function renderLandingCodeExample(libraryId: string) {
  const codeExample = getLandingCodeExample(libraryId)

  if (!codeExample) {
    return null
  }

  return <LandingCodeExampleCard {...codeExample} />
}
