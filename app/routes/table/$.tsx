import { LoaderFunction, redirect } from 'remix'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return redirect('/table/v8')
}

function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  // prettier-ignore
  const reactTablev7List = [
    {from: 'docs/api/overview',to: 'docs/guide/overview',},
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
    {from: 'docs/examples/basic',to: 'docs/examples/react/basic',},
    {from: 'docs/examples/filtering',to: 'docs/examples/react/filters',},
    {from: 'docs/examples/footers',to: 'docs/examples/react/basic',},
    {from: 'docs/examples/grouping',to: 'docs/examples/react/grouping',},
    {from: 'docs/examples/pagination',to: 'docs/examples/react/pagination',},
    {from: 'docs/examples/sorting',to: 'docs/examples/react/sorting',},
    {from: 'docs/examples/row-selection',to: 'docs/examples/react/row-selection',},
    {from: 'docs/examples/row-selection-with-pagination',to: 'docs/examples/react/row-selection',},
    {from: 'docs/examples/expanding',to: 'docs/examples/react/expanding',},
    {from: 'docs/examples/editable-data',to: 'docs/examples/react/editable-data',},
    {from: 'docs/examples/column-ordering',to: 'docs/examples/react/column-ordering',},
    {from: 'docs/examples/column-hiding',to: 'docs/examples/react/column-visibility',},
    {from: 'docs/examples/column-resizing',to: 'docs/examples/react/column-sizing',},
    {from: 'docs/examples/pagination-controlled',to: 'docs/examples/react/pagination-controlled',},
    {from: 'docs/examples/pagination-controlled',to: 'docs/examples/react/pagination-controlled',},
    {from: 'docs/installation',to: 'docs/guide/installation',},
    {from: 'docs/overview',to: 'docs/guide/introduction',},
    {from: 'docs/quick-start',to: 'docs/guide/overview',},
    {from: '',to: '',},
  ]

  reactTablev7List.forEach((item) => {
    if (url.pathname.startsWith(`/table/v7/${item.from}`)) {
      throw redirect(
        `/table/v8/${item.to}?from=reactTableV7&original=https://react-table-v7.tanstack.com/${item.from}`
      )
    }
  })
}
