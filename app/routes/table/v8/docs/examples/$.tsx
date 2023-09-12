import React from 'react'
import { json, LoaderArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { DocTitle } from '~/components/DocTitle'
import { v8branch } from '~/routes/table/v8'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'

export const ErrorBoundary = DefaultErrorBoundary

export const loader = async (context: LoaderArgs) => {
  const { '*': examplePath } = context.params
  const [kind, name] = (examplePath ?? '').split('/')

  return json({ kind, name })
}

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${capitalize(data.kind)} Table ${slugToTitle(
      data.name
    )} Example | TanStack Table Docs`,
    description: `An example showing how to implement ${slugToTitle(
      data.name
    )} in ${capitalize(data.kind)} Table`,
  })
}

export default function RouteReactTableDocs() {
  const { kind, name } = useLoaderData<typeof loader>()

  const examplePath = [kind, name].join('/')

  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      <div className="p-4 lg:p-6">
        <DocTitle>
          {capitalize(kind)} Example: {slugToTitle(name)}
        </DocTitle>
      </div>
      <div className="flex-1 lg:px-6 flex flex-col min-h-0">
        <iframe
          src={`https://codesandbox.io/embed/github/tanstack/table/tree/${v8branch}/examples/${examplePath}?autoresize=1&fontsize=14&theme=${
            isDark ? 'dark' : 'light'
          }`}
          title={`tanstack/table: ${examplePath}`}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          className="flex-1 w-full overflow-hidden lg:rounded-lg shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
        />
      </div>
      <div className="lg:h-16 lg:mt-2" />
    </div>
  )
}
