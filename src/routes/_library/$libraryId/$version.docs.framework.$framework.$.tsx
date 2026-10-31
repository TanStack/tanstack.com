import {
  notFound,
  redirect,
  useLocation,
  useMatch,
  createFileRoute,
} from '@tanstack/react-router'
import { canonicalUrl, seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'
import { Doc } from '~/components/Doc'
import {
  appendPathToDocsHref,
  buildDocsRedirectHref,
  loadDocsRoute,
} from '~/utils/docs'
import { findLibrary, getBranch, getLibrary } from '~/libraries'
import { capitalize } from '~/utils/utils'
import { DocContainer } from '~/components/DocContainer'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { getDocsEmbedRuntimeHeaders } from '~/utils/docs-embed-headers'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/framework/$framework/$',
)({
  staleTime: 1000 * 60 * 5,
  // This route's head() emits the rel=canonical link (it may point at the
  // /latest equivalent), so the root route must not emit its own.
  staticData: {
    ownsCanonicalLink: true,
  },
  loader: async (ctx) => {
    const { _splat: docsPath, framework, version, libraryId } = ctx.params

    const library = getLibrary(libraryId)
    const branch = getBranch(library, version)
    const docsRoot = library.docsRoot || 'docs'
    const requestedDocsPath = `framework/${framework}/${docsPath ?? ''}`
    const result = await loadDocsRoute({
      queryClient: ctx.context.queryClient,
      repo: library.repo,
      branch,
      docsRoot,
      docsPath: requestedDocsPath,
      defaultDocs: library.defaultDocs ?? 'overview',
      frameworks: library.frameworks,
      latestBranch: getBranch(library, 'latest'),
      redirectFromPaths: docsPath
        ? [requestedDocsPath, `${framework}/${docsPath}`]
        : [requestedDocsPath],
    })

    if (result.type === 'redirect') {
      throw redirect({
        href: buildDocsRedirectHref({
          baseHref: ctx.location.href,
          docsPath: result.docsPath,
          libraryId,
          version,
        }),
        statusCode: 308,
      })
    }

    if (result.type === 'not-found') {
      throw notFound()
    }

    return {
      ...result.doc,
      // Old-version pages that still exist on latest canonicalize to /latest
      // (read by getCanonicalHeadTags in __root.tsx).
      canonicalPathOverride: result.latestDocsPath
        ? appendPathToDocsHref({
            docsPath: result.latestDocsPath,
            libraryId,
            version: 'latest',
          })
        : undefined,
    }
  },
  component: Docs,
  pendingComponent: DocsPending,
  headers: ({ loaderData, params }) => {
    const { libraryId, version } = params

    return {
      ...getDocsCacheHeaders({ libraryId, version }),
      'X-Docs-Html': loaderData?.isFallback ? 'no-store' : '1',
      ...getDocsEmbedRuntimeHeaders({
        content: loaderData?.content ?? '',
        version,
      }),
    }
  },
  head: (ctx) => {
    const { libraryId, version, framework, _splat: docsPath } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    const tail = `${library.name} ${capitalize(framework)} Docs`

    const canonicalHref = canonicalUrl(
      ctx.loaderData?.canonicalPathOverride ??
        appendPathToDocsHref({
          docsPath: `framework/${framework}/${docsPath ?? ''}`,
          libraryId,
          version,
        }),
    )

    return {
      meta: [
        ...seo({
          title: ctx.loaderData?.title
            ? `${ctx.loaderData.title} | ${tail}`
            : tail,
          description: ctx.loaderData?.description,
          keywords: ctx.loaderData?.keywords,
          image: ogImageUrl(library.id, {
            title: ctx.loaderData?.title,
            description: ctx.loaderData?.description,
          }),
          noindex: library.visible === false,
        }),
        { property: 'og:url', content: canonicalHref },
        { name: 'twitter:url', content: canonicalHref },
      ],
      links: [{ rel: 'canonical', href: canonicalHref }],
    }
  },
})

function DocsPending() {
  return <DocContainer>{null}</DocContainer>
}

function Docs() {
  const loaderData = Route.useLoaderData()
  const versionMatch = useMatch({ from: '/_library/$libraryId/$version' })
  const config = versionMatch.loaderData?.config
  const { version, libraryId, framework } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const location = useLocation()

  // During client-side navigation between framework docs pages the match can
  // render before its loader has resolved, leaving loaderData undefined.
  if (!loaderData) {
    return <DocsPending />
  }

  const { content, filePath, title } = loaderData

  return (
    <DocContainer>
      <Doc
        key={filePath}
        title={title}
        content={content}
        repo={library.repo}
        branch={branch}
        filePath={filePath}
        colorFrom={library.colorFrom}
        colorTo={library.colorTo}
        textColor={library.textColor}
        shouldRenderToc
        libraryId={libraryId}
        libraryVersion={version === 'latest' ? library.latestVersion : version}
        pagePath={location.pathname}
        config={config}
        framework={framework}
      />
    </DocContainer>
  )
}
