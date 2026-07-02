import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { twMerge } from 'tailwind-merge'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'
import { loadDocs } from '~/utils/docs'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { isSafeHttpUrl } from '~/utils/url-boundary'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/community-resources',
)({
  staleTime: 1000 * 60 * 5,
  loader: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) return { doc: null }

    const root = library.docsRoot || 'docs'

    try {
      const doc = await loadDocs({
        repo: library.repo,
        branch: getBranch(library, version),
        docsRoot: root,
        docsPath: 'community-resources',
      })

      return { doc }
    } catch {
      return { doc: null }
    }
  },
  head: ({ params }) => {
    const library = getLibrary(params.libraryId)
    return {
      meta: seo({
        title: `${library.name} Community Resources`,
        description: `A collection of community resources for ${library.name}.`,
        image: ogImageUrl(library.id, {
          title: `${library.name} · Community Resources`,
        }),
        noindex: library.visible === false,
      }),
    }
  },
  headers: ({ params }) => {
    const { libraryId, version } = params

    return getDocsCacheHeaders({ libraryId, version })
  },
  component: RouteComponent,
})

type ResourceType = 'article' | 'media' | 'utility' | 'other'

const resourceSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  description: v.pipe(v.string(), v.maxLength(500)),
  url: v.pipe(
    v.string(),
    v.maxLength(2048),
    v.check((url) => isSafeHttpUrl(url), 'invalid resource URL'),
  ),
})

type Resource = v.InferOutput<typeof resourceSchema>

function readResources(value: unknown): Array<Resource> {
  const result = v.safeParse(v.array(resourceSchema), value)
  return result.success ? result.output.slice(0, 50) : []
}

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const data = Route.useLoaderData()
  const frontmatter = data.doc?.frontmatter
  const articles = readResources(frontmatter?.articles)
  const media = readResources(frontmatter?.media)
  const utilities = readResources(frontmatter?.utilities)
  const others = readResources(frontmatter?.others)

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
              href={`https://github.com/${library.repo}/edit/main/docs/community-resources.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Submit a PR on GitHub
            </a>{' '}
            to contribute to this list.
          </span>
          {articles.length > 0 && (
            <CommunitySection type="article" resources={articles} />
          )}
          {media.length > 0 && (
            <CommunitySection type="media" resources={media} />
          )}
          {utilities.length > 0 && (
            <CommunitySection type="utility" resources={utilities} />
          )}
          {others.length > 0 && (
            <CommunitySection type="other" resources={others} />
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
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-wrap items-center space-y-2 dark:text-gray-500 p-3 cursor-pointer bg-white dark:bg-white/5 rounded-lg overflow-hidden shadow-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-1 border-gray-200 dark:border-gray-700"
          >
            <span className="text-base font-bold text-gray-800 dark:text-white truncate">
              {res.title}
            </span>
            <div className="h-2" />
            <div className="h-px bg-gray-500 opacity-20 w-full" />
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 w-full h-14">
              {res.description}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}
