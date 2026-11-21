import { getDocsBreadcrumbItems } from '~/utils/docs-breadcrumbs'
import {
  notFound,
  redirect,
  useLocation,
  useMatch,
  createFileRoute,
} from '@tanstack/react-router'
import { canonicalUrl, seo } from '~/utils/seo'
import { getDocsStructuredData } from '~/utils/docs-structured-data'
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
import { MissingDocsLoaderData } from '~/components/MissingDocsLoaderData'
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

    const structuredData = getDocsStructuredData({
      doc: ctx.loaderData,
      library,
      canonicalHref,
    })

    return {
      scripts: structuredData
        ? [
            {
              type: 'application/ld+json',
              children: JSON.stringify(structuredData).replaceAll(
                '<',
                '\\u003c',
              ),
            },
          ]
        : [],
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

function Docs() {
  // The router can briefly render this match before its loader data is
  // available during client-side navigation; wait for it instead of crashing.
  const loaderData = Route.useLoaderData() as
    | ReturnType<typeof Route.useLoaderData>
    | undefined
  const versionMatch = useMatch({ from: '/_library/$libraryId/$version' })
  const config = versionMatch.loaderData?.config
  const params = Route.useParams()
  const { version, libraryId, framework } = params
  const location = useLocation()

  if (!loaderData) {
    return (
      <MissingDocsLoaderData
        routeId="/_library/$libraryId/$version/docs/framework/$framework/$"
        params={params}
        pathname={location.pathname}
      />
    )
  }

  const { content, filePath, title, freshness, canonicalPathOverride } =
    loaderData
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  return (
    <DocContainer>
      <Doc
        key={filePath}
        title={title}
        breadcrumbItems={getDocsBreadcrumbItems({
          doc: { title },
          library,
          canonicalHref: canonicalUrl(
            canonicalPathOverride ?? location.pathname,
          ),
        })}
        freshness={freshness}
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
