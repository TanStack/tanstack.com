import { json, LoaderFunction, MetaFunction, useLoaderData } from 'remix'
import { DocTitle } from '~/components/DocTitle'
import { v8branch } from '~/routes/table/v8'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'

export const loader: LoaderFunction = async (context) => {
  const { '*': examplePath } = context.params
  const [kind, name] = (examplePath ?? '').split('/')

  return json({ kind, name })
}

export let meta: MetaFunction = ({ data }) => {
  return seo({
    title: `${data.kind} Table ${data.name} Example | TanStack Table Docs`,
    description: `An example showing how to implement ${data.name} in ${data.kind} Table`,
  })
}

export default function RouteReactTableDocs() {
  const { kind, name } = useLoaderData()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      <div className="p-4 lg:p-6">
        <DocTitle>
          {capitalize(kind)} Example: {slugToTitle(name)}
        </DocTitle>
      </div>
      <iframe
        src={`https://codesandbox.io/embed/github/tanstack/table/tree/${v8branch}/examples/${[
          kind,
          name,
        ].join('/')}?autoresize=1&fontsize=14&theme=dark`}
        title="tannerlinsley/react-table: basic"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="flex-1 w-full"
      />
      <div className="h-12" />
    </div>
  )
}
