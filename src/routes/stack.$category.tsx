import { createFileRoute, notFound } from '@tanstack/react-router'

import { CategoryArticle } from '~/components/stack/CategoryArticle'
import {
  categoryMeta,
  categorySlugs,
  type CategorySlug,
} from '~/components/stack/stack-categories'
import { seo } from '~/utils/seo'

function isCategorySlug(value: string): value is CategorySlug {
  return (categorySlugs as readonly string[]).includes(value)
}

export const Route = createFileRoute('/stack/$category')({
  // Skip the global left-rail Navbar on category articles; EditorialTopNav
  // (rendered in __root.tsx) provides navigation.
  staticData: {
    showNavbar: false,
  },
  loader: ({ params }) => {
    if (!isCategorySlug(params.category)) {
      throw notFound()
    }
    return { category: params.category, meta: categoryMeta[params.category] }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.meta.shortName} — TanStack stack guide`
        : 'TanStack stack guide',
      description: loaderData?.meta.intro,
    }),
  }),
  component: StackCategoryPage,
})

function StackCategoryPage() {
  const { category } = Route.useLoaderData()
  return <CategoryArticle slug={category} />
}
