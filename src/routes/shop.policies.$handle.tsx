import { createFileRoute, notFound } from '@tanstack/react-router'
import { ShopCrumbs } from '~/components/shop/ui'
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
    <article className="p-6 md:p-11 pb-24 max-w-3xl mx-auto flex flex-col gap-6">
      <ShopCrumbs
        crumbs={[{ label: 'Shop', href: '/shop' }, { label: policy.title }]}
      />
      <header>
        <h1 className="font-shop-display font-bold text-[42px] leading-[1.05] tracking-[-0.02em] text-shop-text">
          {policy.title}
        </h1>
      </header>
      {policy.body ? (
        <div
          className="
            text-shop-text-2 text-[14px] leading-[1.6]
            [&_a]:text-shop-accent [&_a]:underline
            [&_strong]:text-shop-text [&_strong]:font-semibold
            [&_h1]:text-shop-text [&_h1]:font-shop-display [&_h1]:mt-6 [&_h1]:mb-2
            [&_h2]:text-shop-text [&_h2]:font-shop-display [&_h2]:mt-6 [&_h2]:mb-2
            [&_h3]:text-shop-text [&_h3]:font-shop-display [&_h3]:mt-5 [&_h3]:mb-2
          "
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      ) : (
        <p className="text-shop-text-2">This policy has no content yet.</p>
      )}
    </article>
  )
}
