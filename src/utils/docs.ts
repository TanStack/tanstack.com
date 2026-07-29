import { isNotFound, notFound } from '@tanstack/react-router'
import {
  fetchDocs,
  fetchDocsManifest,
  fetchDocsPathManifest,
  fetchDocsRedirect,
  fetchFile,
  fetchRepoDirectoryContents,
} from './docs.functions'
import {
  buildDocsMarkdownRedirectHref,
  buildDocsRedirectHref,
  resolveDocsPathRedirect,
  type DocsPathResolution,
  type DocsRedirectManifest,
} from './docs-redirects'
import { removeLeadingSlash } from './utils'

// Narrow structural fetcher types so tests can inject fakes without hitting
// real GitHub network/cache (mirrors the injectable fetchFile in
// collectRedirectEntriesForFile).
export type LoadDocsRouteFetchers = {
  fetchDocs: (opts: {
    data: { repo: string; branch: string; filePath: string }
  }) => Promise<Awaited<ReturnType<typeof fetchDocs>>>
  fetchDocsPathManifest: (opts: {
    data: { repo: string; branch: string; docsRoot: string }
  }) => Promise<DocsRedirectManifest>
  fetchDocsRedirect: (opts: {
    data: {
      repo: string
      branch: string
      docsRoot: string
      docsPaths: Array<string>
    }
  }) => Promise<string | null>
}

const defaultLoadDocsRouteFetchers: LoadDocsRouteFetchers = {
  fetchDocs,
  fetchDocsPathManifest,
  fetchDocsRedirect,
}

export const loadDocs = async (
  {
    repo,
    branch,
    docsRoot,
    docsPath,
  }: {
    repo: string
    branch: string
    docsRoot: string
    docsPath: string
  },
  fetchDocsFn: LoadDocsRouteFetchers['fetchDocs'] = fetchDocs,
) => {
  if (!branch || !docsRoot || !docsPath) {
    throw notFound({
      data: {
        message: 'No doc was found here!',
      },
    })
  }

  const doc = await fetchDocsFn({
    data: {
      repo,
      branch,
      filePath: `${removeLeadingSlash(docsRoot)}/${docsPath}.md`,
    },
  })

  if (!doc) {
    throw notFound({
      data: {
        message: 'No doc was found here!',
      },
    })
  }

  return doc
}

export async function getDocsManifest(opts: {
  repo: string
  branch: string
  docsRoot: string
}) {
  return fetchDocsManifest({ data: opts })
}

export async function resolveDocsRoutePath(
  opts: {
    branch: string
    defaultDocs: string
    docsPath: string
    docsRoot: string
    frameworks: Array<string>
    repo: string
  },
  fetchers: LoadDocsRouteFetchers = defaultLoadDocsRouteFetchers,
): Promise<DocsPathResolution> {
  const defaultDocsResolution = getDefaultDocsResolution(opts)

  if (defaultDocsResolution) {
    return defaultDocsResolution
  }

  const manifest = await fetchers.fetchDocsPathManifest({
    data: {
      repo: opts.repo,
      branch: opts.branch,
      docsRoot: opts.docsRoot,
    },
  })

  if (manifest.paths.length === 0) {
    return { type: 'render', docsPath: opts.docsPath }
  }

  return resolveDocsPathRedirect({
    defaultDocs: opts.defaultDocs,
    docsPath: opts.docsPath,
    frameworks: opts.frameworks,
    manifest,
  })
}

function getDefaultDocsResolution(opts: {
  defaultDocs: string
  docsPath: string
  frameworks: Array<string>
}): DocsPathResolution | null {
  const docsPath = normalizeRouteDocsPath(opts.docsPath)
  const defaultDocs = normalizeRouteDocsPath(opts.defaultDocs)

  if (!docsPath || !defaultDocs) {
    return null
  }

  if (docsPath === defaultDocs) {
    return {
      type: 'render',
      docsPath,
    }
  }

  const [framework, ...restParts] = docsPath.split('/')
  const restPath = restParts.join('/')

  if (
    framework &&
    opts.frameworks.includes(framework) &&
    restPath === 'overview' &&
    defaultDocs === `framework/${framework}/overview`
  ) {
    return {
      type: 'redirect',
      docsPath: defaultDocs,
    }
  }

  return null
}

function normalizeRouteDocsPath(path: string) {
  return removeLeadingSlash(path.trim())
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
    .replace(/\/+$/g, '')
}

export type LoadDocsRouteResult =
  | {
      type: 'loaded'
      docsPath: string
      doc: Awaited<ReturnType<typeof loadDocs>>
    }
  | {
      type: 'redirect'
      docsPath: string
    }
  | {
      type: 'not-found'
    }

export async function loadDocsRoute(
  opts: {
    branch: string
    defaultDocs: string
    docsPath: string
    docsRoot: string
    frameworks: Array<string>
    redirectFromPaths: Array<string>
    repo: string
  },
  fetchers: LoadDocsRouteFetchers = defaultLoadDocsRouteFetchers,
): Promise<LoadDocsRouteResult> {
  const resolution = await resolveDocsRoutePathWithRedirects(opts, fetchers)

  if (resolution.type !== 'render') {
    return resolution
  }

  try {
    return {
      type: 'loaded',
      docsPath: resolution.docsPath,
      doc: await loadDocs(
        {
          repo: opts.repo,
          branch: opts.branch,
          docsRoot: opts.docsRoot,
          docsPath: resolution.docsPath,
        },
        fetchers.fetchDocs,
      ),
    }
  } catch (error) {
    if (!isDocsNotFoundError(error)) {
      throw error
    }

    // The docs path manifest canonicalizes `<path>/index.md` files to
    // `<path>` (see getCanonicalDocsPath in docs.functions.ts), so a
    // resolvable docs path may be backed by an index file instead of
    // `<path>.md`. Retry the index file before falling back to redirects,
    // otherwise committed pages like `reference/index.md` 404 at their
    // canonical URL.
    const indexDoc = await loadDocsIndexFile(
      opts,
      resolution.docsPath,
      fetchers,
    )

    if (indexDoc !== null) {
      return {
        type: 'loaded',
        docsPath: resolution.docsPath,
        doc: indexDoc,
      }
    }

    const redirectPath = await resolveDocsRedirectFromPaths(opts, fetchers)

    if (redirectPath !== null) {
      return {
        type: 'redirect',
        docsPath: redirectPath,
      }
    }

    return { type: 'not-found' }
  }
}

async function loadDocsIndexFile(
  opts: {
    branch: string
    docsRoot: string
    repo: string
  },
  docsPath: string,
  fetchers: LoadDocsRouteFetchers,
) {
  if (!docsPath || docsPath === 'index' || docsPath.endsWith('/index')) {
    return null
  }

  try {
    return await loadDocs(
      {
        repo: opts.repo,
        branch: opts.branch,
        docsRoot: opts.docsRoot,
        docsPath: `${docsPath}/index`,
      },
      fetchers.fetchDocs,
    )
  } catch (error) {
    if (!isDocsNotFoundError(error)) {
      throw error
    }

    return null
  }
}

async function resolveDocsRoutePathWithRedirects(
  opts: {
    branch: string
    defaultDocs: string
    docsPath: string
    docsRoot: string
    frameworks: Array<string>
    redirectFromPaths: Array<string>
    repo: string
  },
  fetchers: LoadDocsRouteFetchers,
): Promise<DocsPathResolution> {
  const resolution = await resolveDocsRoutePath(opts, fetchers)

  if (resolution.type !== 'not-found') {
    return resolution
  }

  const redirectPath = await resolveDocsRedirectFromPaths(opts, fetchers)

  if (redirectPath !== null) {
    return {
      type: 'redirect',
      docsPath: redirectPath,
    }
  }

  return resolution
}

async function resolveDocsRedirectFromPaths(
  opts: {
    branch: string
    docsRoot: string
    redirectFromPaths: Array<string>
    repo: string
  },
  fetchers: LoadDocsRouteFetchers,
) {
  const docsPaths = opts.redirectFromPaths.filter(Boolean)

  if (docsPaths.length === 0) {
    return null
  }

  return fetchers.fetchDocsRedirect({
    data: {
      repo: opts.repo,
      branch: opts.branch,
      docsRoot: opts.docsRoot,
      docsPaths,
    },
  })
}

function isDocsNotFoundError(error: unknown) {
  return (
    isNotFound(error) ||
    (error && typeof error === 'object' && 'isNotFound' in error)
  )
}

export async function resolveDocsRedirect(opts: {
  repo: string
  branch: string
  docsRoot: string
  docsPaths: Array<string>
}) {
  return fetchDocsRedirect({ data: opts })
}

export {
  buildDocsMarkdownRedirectHref,
  buildDocsRedirectHref,
  fetchFile,
  fetchRepoDirectoryContents,
}
