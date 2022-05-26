import { LoaderFunction, redirect } from 'remix'

export function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  // prettier-ignore
  const reactTablev7List = [
    {from: '/table/v7/docs/api/overview',to: '/table/v8/docs/guide/01-overview',},
    {from: '/table/v7/docs/api/useColumnOrder',to: '/table/v8/docs/api/features/column-ordering',},
    {from: '/table/v7/docs/api/useExpanded',to: '/table/v8/docs/api/features/expanding',},
    {from: '/table/v7/docs/api/useFilters',to: '/table/v8/docs/api/features/filters',},
    {from: '/table/v7/docs/api/useGlobalFilter',to: '/table/v8/docs/api/features/filters',},
    {from: '/table/v7/docs/api/useGroupBy',to: '/table/v8/docs/api/features/grouping',},
    {from: '/table/v7/docs/api/usePagination',to: '/table/v8/docs/api/features/pagination',},
    {from: '/table/v7/docs/api/useResizeColumns',to: '/table/v8/docs/api/features/column-resizing',},
    {from: '/table/v7/docs/api/useRowSelect',to: '/table/v8/docs/api/features/row-selection',},
    {from: '/table/v7/docs/api/useSortBy',to: '/table/v8/docs/api/features/sorting',},
    {from: '/table/v7/docs/api/useTable',to: '/table/v8/docs/guide/03-tables',},
    {from: '/table/v7/docs/examples/basic',to: '/table/v8/docs/examples/react/basic',},
    {from: '/table/v7/docs/examples/filtering',to: '/table/v8/docs/examples/react/filters',},
    {from: '/table/v7/docs/examples/footers',to: '/table/v8/docs/examples/react/basic',},
    {from: '/table/v7/docs/examples/grouping',to: '/table/v8/docs/examples/react/grouping',},
    {from: '/table/v7/docs/examples/pagination',to: '/table/v8/docs/examples/react/pagination',},
    {from: '/table/v7/docs/examples/sorting',to: '/table/v8/docs/examples/react/sorting',},
    {from: '/table/v7/docs/examples/row-selection',to: '/table/v8/docs/examples/react/row-selection',},
    {from: '/table/v7/docs/examples/row-selection-with-pagination',to: '/table/v8/docs/examples/react/row-selection',},
    {from: '/table/v7/docs/examples/expanding',to: '/table/v8/docs/examples/react/expanding',},
    {from: '/table/v7/docs/examples/editable-data',to: '/table/v8/docs/examples/react/editable-data',},
    {from: '/table/v7/docs/examples/column-ordering',to: '/table/v8/docs/examples/react/column-ordering',},
    {from: '/table/v7/docs/examples/column-hiding',to: '/table/v8/docs/examples/react/column-visibility',},
    {from: '/table/v7/docs/examples/column-resizing',to: '/table/v8/docs/examples/react/column-resizing',},
    {from: '/table/v7/docs/examples/pagination-controlled',to: '/table/v8/docs/examples/react/pagination-controlled',},
    {from: '/table/v7/docs/examples/pagination-controlled',to: '/table/v8/docs/examples/react/pagination-controlled',},
    {from: '/table/v7/docs/installation',to: '/table/v8/docs/guide/02-installation',},
    {from: '/table/v7/docs/overview',to: '/table/v8/docs/guide/00-introduction',},
    {from: '/table/v7/docs/quick-start',to: '/table/v8/docs/guide/01-overview',},
    {from: '/table/v7',to: '/table/v8',},
  ]

  reactTablev7List.forEach((item) => {
    if (url.pathname.startsWith(item.from)) {
      throw redirect(`${item.to}?from=reactTableV7`)
    }
  })
}
