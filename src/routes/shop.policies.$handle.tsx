import { createFileRoute, notFound } from '@tanstack/react-router'
import { Breadcrumbs } from '~/components/shop/Breadcrumbs'
import { getShopPolicy } from '~/utils/shop.functions'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/shop/policies/$handle')({
  loader: async ({ params }) => {
    const policy = await getShopPolicy({ data: { handle: params.handle } })
    if (!policy) throw notFound()
    return { policy }
  },
  head: ({ loaderData }) => {
    const p = loaderData?.policy
    if (!p) return { meta: [] }
    return {
      meta: seo({
        title: `${p.title} | TanStack Shop`,
      }),
    }
  },
  component: PolicyPage,
})

function PolicyPage() {
  const { policy } = Route.useLoaderData()
  return (
    <article className="flex flex-col max-w-3xl mx-auto gap-8 p-4 md:p-8">
      <Breadcrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: policy.title }]}
      />
      <header>
        <h1 className="text-3xl font-black">{policy.title}</h1>
      </header>
      {policy.body ? (
        <div
          className="prose dark:prose-invert max-w-none"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          This policy has no content yet.
        </p>
      )}
    </article>
  )
}
