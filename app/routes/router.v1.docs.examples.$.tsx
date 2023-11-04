import * as React from 'react'
import type { LoaderFunction, V2_MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { DocTitle } from '~/components/DocTitle'
import { v1branch } from '~/routes/router.v1'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'

export const loader: LoaderFunction = async (context) => {
  const { '*': examplePath } = context.params
  const [kind, _name] = (examplePath ?? '').split('/')
  const [name, search] = _name.split('?')

  return json({ kind, name, search: search ?? '' })
}

export const meta: V2_MetaFunction = ({ data }) => {
  return seo({
    title: `${capitalize(data.kind)} Router ${slugToTitle(
      data.name
    )} Example | TanStack Router Docs`,
    description: `An example showing how to implement ${slugToTitle(
      data.name
    )} in ${capitalize(data.kind)} Router`,
  })
}

export default function RouteReactTableDocs() {
  const { kind, name, search } = useLoaderData()

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
          src={`https://stackblitz.com/github/tanstack/router/tree/${v1branch}/examples/${examplePath}?${search}embed=1&theme=${
            isDark ? 'dark' : 'light'
          }`}
          title={`tanstack/router: ${examplePath}`}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          className="flex-1 w-full overflow-hidden lg:rounded-lg shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
        />
      </div>
      <div className="lg:h-16 lg:mt-2" />
    </div>
  )
}
