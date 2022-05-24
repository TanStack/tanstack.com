import { json, LoaderFunction, useLoaderData } from 'remix'
import { DocTitle } from '~/components/DocTitle'
import { v8branch } from '~/routes/table/v8'
import { capitalize, slugToTitle } from '~/utils/utils'

export const loader: LoaderFunction = async (context) => {
  const { '*': examplePath } = context.params

  return json(examplePath)
}

export default function RouteReactTableDocs() {
  const examplePath = useLoaderData()

  const [kind, name] = examplePath.split('/')

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 lg:p-6">
        <DocTitle>
          {capitalize(kind)} Example: {slugToTitle(name)}
        </DocTitle>
      </div>
      <iframe
        src={`https://codesandbox.io/embed/github/tanstack/react-table/tree/${v8branch}/examples/${examplePath}?autoresize=1&fontsize=14&theme=dark`}
        title="tannerlinsley/react-table: basic"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        className="flex-1 w-full"
      />
    </div>
  )
}
