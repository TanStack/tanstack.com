import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import RemoveMarkdown from 'remove-markdown'
import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn, json } from '@tanstack/react-router-server'

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

  return await fetchDocs({
    repo,
    branch,
    filePath,
    currentPath,
    redirectPath,
  })
}

export const fetchDocs = createServerFn(
  'GET',
  async ({
    repo,
    branch,
    filePath,
    currentPath,
    redirectPath,
  }: {
    repo: string
    branch: string
    filePath: string
    currentPath: string
    redirectPath: string
  }) => {
    'use server'

    const file = await fetchRepoFile(repo, branch, filePath)

    console.log({
      currentPath,
      redirectPath,
    })

    if (!file) {
      throw notFound()
      // if (currentPath === redirectPath) {
      //   console.log('not found')
      //   throw notFound()
      // } else {
      //   console.log('redirect')
      //   throw redirect({
      //     to: redirectPath,
      //   })
      // }
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
