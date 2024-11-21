import { extractFrontMatter, fetchRepoFile } from '~/utils/documents.server'
import removeMarkdown from 'remove-markdown'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/start'
import { z } from 'zod'
import { setHeader } from 'vinxi/http'

export const loadDocs = async ({
  repo,
  branch,
  // currentPath,
  // redirectPath,
  docsPath,
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
    data: {
      repo,
      branch,
      filePath,
      // currentPath,
      // redirectPath,
    },
  })
}

export const fetchDocs = createServerFn({ method: 'GET' })
  .validator(
    z.object({ repo: z.string(), branch: z.string(), filePath: z.string() })
  )
  .handler(async ({ data: { repo, branch, filePath } }) => {
    const file = await fetchRepoFile(repo, branch, filePath)

    if (!file) {
      throw notFound()
      // if (currentPath === redirectPath) {
      //   // console.log('not found')
      //   throw notFound()
      // } else {
      //   // console.log('redirect')
      //   throw redirect({
      //     to: redirectPath,
      //   })
      // }
    }

    const frontMatter = extractFrontMatter(file)
    const description = removeMarkdown(frontMatter.excerpt ?? '')

    console.log({
      title: frontMatter.data?.title,
      description,
      filePath,
      // content: frontMatter.content,
    })

    setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=300')

    return {
      title: frontMatter.data?.title,
      description,
      filePath,
      content: frontMatter.content,
    }
  })
