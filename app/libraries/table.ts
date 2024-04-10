import { handleRedirects } from '~/utils/handleRedirects.server'
import { Library } from '.'

export const tableProject: Library = {
  id: 'table',
  name: 'TanStack Table',
  cardStyles: `shadow-xl shadow-blue-700/20 dark:shadow-lg dark:shadow-blue-500/30 text-blue-500 border-2 border-transparent hover:border-current`,
  to: '/table',
  tagline: `Headless UI for building powerful tables & datagrids`,
  description: `Supercharge your tables or build a datagrid from scratch for TS/JS, React, Vue, Solid, Svelte, Qwik, and Angular while retaining 100% control over markup and styles.`,
  ogImage: 'https://github.com/tanstack/table/raw/main/media/repo-header.png',
  bgStyle: 'bg-blue-500',
  textStyle: 'text-blue-500',
  repo: 'tanstack/table',
  latestBranch: 'main',
  latestVersion: 'v8',
  availableVersions: ['v8'],
  colorFrom: 'from-teal-500',
  colorTo: 'to-blue-600',
  textColor: 'text-blue-600',
  frameworks: ['angular', 'qwik', 'react', 'solid', 'svelte', 'vue', 'vanilla'],
  scarfId: 'dc8b39e1-3fe9-4f3a-8e56-d4e2cf420a9e',
  defaultDocs: 'framework/react/overview',
  handleRedirects: (href) => {
    handleRedirects(
      reactTableV7List,
      href,
      '/table/v7',
      '/table/v8',
      'from=reactTableV7'
    )
  },
}

// prettier-ignore
export const reactTableV7List = [
    {from: 'docs/api/overview',to: 'docs/overview',},
    {from: 'docs/api/useColumnOrder',to: 'docs/api/features/column-ordering',},
    {from: 'docs/api/useExpanded',to: 'docs/api/features/expanding',},
    {from: 'docs/api/useFilters',to: 'docs/api/features/filters',},
    {from: 'docs/api/useGlobalFilter',to: 'docs/api/features/filters',},
    {from: 'docs/api/useGroupBy',to: 'docs/api/features/grouping',},
    {from: 'docs/api/usePagination',to: 'docs/api/features/pagination',},
    {from: 'docs/api/useResizeColumns',to: 'docs/api/features/column-sizing',},
    {from: 'docs/api/useRowSelect',to: 'docs/api/features/row-selection',},
    {from: 'docs/api/useSortBy',to: 'docs/api/features/sorting',},
    {from: 'docs/api/useTable',to: 'docs/guide/tables',},
    {from: 'docs/examples/basic',to: 'docs/framework/react/examples/basic',},
    {from: 'docs/examples/filtering',to: 'docs/framework/react/examples/filters',},
    {from: 'docs/examples/footers',to: 'docs/framework/react/examples/basic',},
    {from: 'docs/examples/grouping',to: 'docs/framework/react/examples/grouping',},
    {from: 'docs/examples/pagination-controlled',to: 'docs/framework/react/examples/pagination-controlled',},
    {from: 'docs/examples/pagination',to: 'docs/framework/react/examples/pagination',},
    {from: 'docs/examples/sorting',to: 'docs/framework/react/examples/sorting',},
    {from: 'docs/examples/row-selection',to: 'docs/framework/react/examples/row-selection',},
    {from: 'docs/examples/row-selection-with-pagination',to: 'docs/framework/react/examples/row-selection',},
    {from: 'docs/examples/expanding',to: 'docs/framework/react/examples/expanding',},
    {from: 'docs/examples/editable-data',to: 'docs/framework/react/examples/editable-data',},
    {from: 'docs/examples/column-ordering',to: 'docs/framework/react/examples/column-ordering',},
    {from: 'docs/examples/column-hiding',to: 'docs/framework/react/examples/column-visibility',},
    {from: 'docs/examples/column-resizing',to: 'docs/framework/react/examples/column-sizing',},
    {from: 'docs/installation',to: 'docs/installation',},
    {from: 'docs/overview',to: 'docs/introduction',},
    {from: 'docs/quick-start',to: 'docs/overview',},
]
