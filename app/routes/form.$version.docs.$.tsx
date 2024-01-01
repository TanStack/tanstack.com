import { redirect, type LoaderFunctionArgs } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  const { '*': docsPath } = context.params

  throw redirect(
    // By default we'll redirect to the react docs
    context.request.url.replace(/\/docs.*/, `/docs/framework/react/${docsPath}`)
  )
}
