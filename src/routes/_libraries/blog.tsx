import { Link } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  head: () => ({
    meta: seo({
      title: 'Blog | TanStack',
      description: 'The latest news and blog posts from TanStack!',
    }),
  }),
})

export function PostNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <h1 className="flex flex-col text-center font-black opacity-10">
        <div className="text-7xl leading-none">404</div>
        <div className="text-3xl leading-none">Not Found</div>
      </h1>
      <div className="text-lg">Post not found.</div>
      <Link
        to="/blog"
        className={`rounded bg-gray-600 px-4 py-2 font-extrabold text-white uppercase dark:bg-gray-700`}
      >
        Blog Home
      </Link>
    </div>
  )
}
