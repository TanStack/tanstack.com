import { json, redirect } from '@remix-run/node'
import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import RemoveMarkdown from 'remove-markdown'

export async function loadDocs({
  repo,
  branch,
  docPath,
  currentPath,
  redirectPath,
}: {
  repo: string
  branch: string
  docPath: string
  currentPath: string
  redirectPath: string
}) {
  if (!branch) {
    throw new Error('Invalid branch')
  }

  if (!docPath) {
    throw new Error('Invalid docPath')
  }

  const filePath = `${docPath}.md`
  const file = await fetchRepoFile(repo, branch, filePath)

  if (!file) {
    if (currentPath === redirectPath) {
      throw new Error('File does not exist')
    } else {
      throw redirect(redirectPath)
    }
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
