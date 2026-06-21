import { notFound } from '@tanstack/react-router'
import {
  fetchDocs,
  fetchDocsManifest,
  fetchDocsRedirect,
  fetchFile,
  fetchRepoDirectoryContents,
} from './docs.functions'
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
    throw notFound({
      data: {
        message: 'No doc was found here!',
      },
    })
  }

  return fetchDocs({
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
