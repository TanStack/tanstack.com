import { json, redirect } from '@remix-run/node'
import {
  extractFrontMatter,
  fetchRepoFile,
  markdownToMdx,
} from './documents.server'
import RemoveMarkdown from 'remove-markdown'

export async function loadDocs({
  repo,
  branch,
  docPath,
  redirectPath,
}: {
  repo: string
  branch: string
  docPath: string
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
    throw redirect(redirectPath)
  }

  const frontMatter = extractFrontMatter(file)
  const description = RemoveMarkdown(frontMatter.excerpt ?? '')

  const mdx = await markdownToMdx(frontMatter.content)

  return json(
    {
      title: frontMatter.data?.title,
      description,
      filePath,
      code: mdx.code,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=1, stale-while-revalidate=300',
      },
    }
  )
}
