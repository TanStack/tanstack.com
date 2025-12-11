import { createFileRoute } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { loadDocs } from '~/utils/docs'

export const Route = createFileRoute(
  '/$libraryId/$version/docs/community-resources',
)({
  staleTime: 1000 * 60 * 5,
  loader: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) return { doc: null as null | any }

    const root = library.docsRoot || 'docs'

    try {
      const doc = await loadDocs({
        repo: library.repo,
        branch: getBranch(library, version),
        docsPath: `${root}/community-resources`,
        currentPath: ctx.location.pathname,
        redirectPath: `/${library.id}/${version}/docs/overview`,
      })

      return { doc }
    } catch {
      return { doc: null as null | any }
    }
  },
  head: ({ params }) => {
    const library = getLibrary(params.libraryId)
    return {
      meta: seo({
        title: `${library.name} Community Resources`,
        description: `A collection of community resources for ${library.name}.`,
      }),
    }
  },
  component: RouteComponent,
})

type ResourceType = 'article' | 'media' | 'utility' | 'other'

type Resource = {
  title: string
  description: string
  url: string
}

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const data = Route.useLoaderData()
  const frontmatter = data.doc?.frontmatter

  return (
    <DocContainer>
      <div
        className={twMerge(
          'w-full flex flex-col bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[1200px]',
        )}
      >
        <div className="p-4 lg:p-6 flex flex-col space-y-4 w-full">
          <div className={twMerge('flex overflow-auto flex-col w-full')}>
            <DocTitle>Community Resources</DocTitle>
            <div className="h-4" />
            <div className="h-px bg-gray-500 opacity-20" />
          </div>
          <span>
            Discover resources created by the <strong>{library.name}</strong>{' '}
            community. Have something to share?{' '}
            <a
              href={`https://github.com/${libraryId}/edit/main/docs/community-resources.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Submit a PR on GitHub
            </a>{' '}
            to contribute to this list.
          </span>
          {frontmatter?.articles && (
            <CommunitySection
              type="article"
              resources={frontmatter?.articles}
            />
          )}
          {frontmatter?.media && (
            <CommunitySection type="media" resources={frontmatter?.media} />
          )}
          {frontmatter?.utilities && (
            <CommunitySection
              type="utility"
              resources={frontmatter?.utilities}
            />
          )}
          {frontmatter?.others && (
            <CommunitySection type="other" resources={frontmatter?.others} />
          )}
        </div>
      </div>
    </DocContainer>
  )
}

function CommunitySection({
  resources,
  type,
}: {
  resources: Resource[]
  type: ResourceType
}) {
  return (
    <section>
      <h2 className="text-[1.5rem] font-semibold pb-4 capitalize">{type}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ">
        {resources.map((res) => (
          <a
            key={res.url}
            href={res.url}
            className="flex flex-wrap items-center space-y-2 dark:text-gray-500 p-3 cursor-pointer bg-white dark:bg-white/5 rounded-lg overflow-hidden shadow-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-1 border-gray-200 dark:border-gray-700"
          >
            <span className="text-base font-bold text-gray-800 dark:text-white truncate">
              {res.title}
            </span>
            <div className="h-2" />
            <div className="h-px bg-gray-500 opacity-20 w-full" />
            <p className="text-sm dark:text-gray-400 text-gray-50 line-clamp-3 w-full h-14">
              {res.description}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}
