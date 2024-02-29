import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import RemoveMarkdown from 'remove-markdown'
import {
  RegisteredRouter,
  RouteIds,
  createServerFn,
  json,
  notFound,
  redirect,
} from '@tanstack/react-router'

export const loadDocs = async ({
  repo,
  branch,
  docsPath,
  currentPath,
  redirectPath,
}: {
  repo: string
  branch: string
  docsPath: string
  currentPath: string
  redirectPath: string
}) => {
  if (!branch) {
    throw new Error('Invalid branch')
  }

  if (!docsPath) {
    throw new Error('Invalid docPath')
  }

  const filePath = `${docsPath}.md`

  const file = await fetchDocs({
    repo,
    branch,
    filePath,
  })

  if (!file) {
    if (currentPath === redirectPath) {
      throw notFound()
    } else {
      throw redirect({
        to: redirectPath,
      })
    }
  }

  return file
}

export const fetchDocs = createServerFn(
  'GET',
  async ({
    repo,
    branch,
    filePath,
  }: {
    repo: string
    branch: string
    filePath: string
  }) => {
    'use server'

    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      return undefined
    }

    const frontMatter = extractFrontMatter(file)
    const description = RemoveMarkdown(frontMatter.excerpt ?? '')

    return json(
      {
        title: frontMatter.data?.title,
        description,
        filePath,
        content: frontMatter.content,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=1, stale-while-revalidate=300',
        },
      }
    )
  }
)
