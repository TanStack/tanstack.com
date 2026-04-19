import { createFileRoute, notFound } from '@tanstack/react-router'
import { Breadcrumbs } from '~/components/shop/Breadcrumbs'
import { getPage } from '~/utils/shop.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/shop/pages/$handle')({
  loader: async ({ params }) => {
    const page = await getPage({ data: { handle: params.handle } })
    if (!page) throw notFound()
    return { page }
  },
  head: ({ loaderData }) => {
    const p = loaderData?.page
    if (!p) return { meta: [] }
    return {
      meta: seo({
        title: `${p.seo.title ?? p.title} | TanStack Shop`,
        description: p.seo.description ?? p.bodySummary ?? undefined,
      }),
    }
  },
  component: ShopPage,
})

function ShopPage() {
  const { page } = Route.useLoaderData()
  return (
    <article className="flex flex-col max-w-3xl mx-auto gap-8 p-4 md:p-8">
      <Breadcrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: page.title }]}
      />
      <header>
        <h1 className="text-3xl font-black">{page.title}</h1>
      </header>
      {page.body ? (
        <div
          className="prose dark:prose-invert max-w-none"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          This page has no content yet.
        </p>
      )}
    </article>
  )
}
