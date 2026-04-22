import {
  fetchDocs,
  fetchDocsPage,
  fetchDocsManifest,
  fetchDocsRedirect,
  fetchFile,
  fetchRepoDirectoryContents,
} from './docs.functions'
import { createDocsNotFoundError } from './docs-errors'
import { removeLeadingSlash } from './utils'

export const loadDocs = async ({
  repo,
  branch,
  docsRoot,
  docsPath,
}: {
  repo: string
  branch: string
  docsRoot: string
  docsPath: string
}) => {
  if (!branch || !docsRoot || !docsPath) {
    throw createDocsNotFoundError()
  }

  return fetchDocs({
    data: {
      repo,
      branch,
      filePath: `${removeLeadingSlash(docsRoot)}/${docsPath}.md`,
    },
  })
}

export const loadDocsPage = async ({
  repo,
  branch,
  docsRoot,
  docsPath,
}: {
  repo: string
  branch: string
  docsRoot: string
  docsPath: string
}) => {
  if (!branch || !docsRoot || !docsPath) {
    throw createDocsNotFoundError()
  }

  return fetchDocsPage({
    data: {
      repo,
      branch,
      filePath: `${removeLeadingSlash(docsRoot)}/${docsPath}.md`,
    },
  })
}

export async function getDocsManifest(opts: {
  repo: string
  branch: string
  docsRoot: string
}) {
  return fetchDocsManifest({ data: opts })
}

export async function resolveDocsRedirect(opts: {
  repo: string
  branch: string
  docsRoot: string
  docsPaths: Array<string>
}) {
  return fetchDocsRedirect({ data: opts })
}

export { fetchFile, fetchRepoDirectoryContents }
