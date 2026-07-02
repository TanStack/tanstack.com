import { createFileRoute, notFound } from '@tanstack/react-router'

import { CategoryArticle } from '~/components/stack/CategoryArticle'
import {
  categoryMeta,
  categorySlugs,
  getCategoryLibraries,
  type CategorySlug,
} from '~/components/stack/stack-categories'
import { fetchRelatedPostsForLibraries } from '~/utils/blog.functions'
import { seo } from '~/utils/seo'

function isCategorySlug(value: string): value is CategorySlug {
  return (categorySlugs as readonly string[]).includes(value)
}

export const Route = createFileRoute('/stack/$category')({
  staleTime: Infinity,
  loader: async ({ params }) => {
    if (!isCategorySlug(params.category)) {
      throw notFound()
    }

    const libraries = getCategoryLibraries(params.category)
    const relatedPosts = await fetchRelatedPostsForLibraries({
      data: libraries.map((lib) => lib.id),
    })

    return {
      category: params.category,
      meta: categoryMeta[params.category],
      relatedPosts,
    }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.meta.shortName} — TanStack libraries`
        : 'TanStack libraries',
      description: loaderData?.meta.intro,
    }),
  }),
  component: StackCategoryPage,
})

function StackCategoryPage() {
  const { category, relatedPosts } = Route.useLoaderData()
  return <CategoryArticle slug={category} relatedPosts={relatedPosts} />
}
