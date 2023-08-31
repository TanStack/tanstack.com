import React from 'react'
import type { LoaderArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams } from '@remix-run/react'
import { DocTitle } from '~/components/DocTitle'
import { repo, getBranch } from '~/routes/store'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'

export const loader = async (context: LoaderArgs) => {
  const { framework: kind, '*': name } = context.params

  return json({ kind, name })
}

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${capitalize(data.kind)} Store ${slugToTitle(
      data.name
    )} Example | TanStack Store Docs`,
    description: `An example showing how to implement ${slugToTitle(
      data.name
    )} in ${capitalize(data.kind)} Store`,
  })
}

export default function RouteExamples() {
  const { kind, name } = useLoaderData<typeof loader>()
  const { version } = useParams()
  const branch = getBranch(version)

  const examplePath = branch === 'v3' ? name : [kind, name].join('/')
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
          src={`https://codesandbox.io/embed/github/${repo}/tree/${branch}/examples/${examplePath}?autoresize=1&fontsize=14&theme=${
            isDark ? 'dark' : 'light'
          }`}
          title={`${repo}: ${examplePath}`}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          className="flex-1 w-full overflow-hidden lg:rounded-lg shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
        />
      </div>
      <div className="lg:h-16 lg:mt-2" />
    </div>
  )
}
