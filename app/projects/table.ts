import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/table'

export const latestBranch = 'main'
export const latestVersion = 'v8'
export const availableVersions = ['v8']

export const colorFrom = 'from-teal-500'
export const colorTo = 'to-blue-600'
export const textColor = 'text-blue-600'

export const frameworks: AvailableOptions = [
  { label: 'React', value: 'react', logo: reactLogo },
  { label: 'Solid', value: 'solid', logo: solidLogo },
  { label: 'Svelte', value: 'svelte', logo: svelteLogo },
  { label: 'Vue', value: 'vue', logo: vueLogo },
]

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
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

export const reactTableV7NotDocPagesList = [{ from: '', to: '' }]
