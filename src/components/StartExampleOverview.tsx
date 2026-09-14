import { CodeBlock } from '~/components/markdown'
import { getStartExamplePage } from '~/utils/start-example-pages'

export function StartExampleOverview({
  params,
}: {
  params: {
    libraryId: string
    version: string
    framework: string
    _splat?: string
  }
}) {
  const page = getStartExamplePage(params)
  if (!page) return null
  const source = `https://github.com/TanStack/router/blob/main/examples/react/${page.slug}`
  return (
    <section className="prose dark:prose-invert max-w-3xl px-4 pb-6 lg:px-6">
      <p>{page.description}</p>
      <p>{page.details}</p>
      <h2>Run locally</h2>
      <p>
        Use Node.js 22.12 or newer and pnpm 11. These examples fetch public
        sample data from JSONPlaceholder, so an internet connection is required.
        No API key or database is needed.
      </p>
      <CodeBlock>
        <code className="language-sh">{`git clone https://github.com/TanStack/router.git
cd router
pnpm install
cd examples/react/${page.slug}
pnpm dev`}</code>
      </CodeBlock>
      <p>{page.note}</p>
      <p>
        Run <code>pnpm build</code> from the example directory to build the app
        and check its types.
      </p>
      <h2>Files to follow</h2>
      <ul>
        {page.files.map((file) => (
          <li key={file.path}>
            <a href={`${source}/${file.path}`}>{file.path}</a>
            {`: ${file.description}`}
          </li>
        ))}
      </ul>
      <p>
        <a href={`/start/latest/docs/framework/react/guide/${page.guide}`}>
          {page.guideTitle}
        </a>
      </p>
    </section>
  )
}
