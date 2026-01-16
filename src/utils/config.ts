import * as v from 'valibot'
import { fetchRepoFile } from './documents.server'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'

export type MenuItem = {
  label: string | React.ReactNode
  children: {
    label: string | React.ReactNode
    to: string
    badge?: string
  }[]
  collapsible?: boolean
  defaultCollapsed?: boolean
}

const configSchema = v.object({
  sections: v.array(
    v.object({
      label: v.string(),
      children: v.array(
        v.object({
          label: v.string(),
          to: v.string(),
          badge: v.optional(v.string()),
        }),
      ),
      frameworks: v.optional(
        v.array(
          v.object({
            label: v.string(),
            children: v.array(
              v.object({
                label: v.string(),
                to: v.string(),
                badge: v.optional(v.string()),
              }),
            ),
          }),
        ),
      ),
      collapsible: v.optional(v.boolean()),
      defaultCollapsed: v.optional(v.boolean()),
    }),
  ),
  users: v.optional(v.array(v.string())),
})

export type ConfigSchema = v.InferOutput<typeof configSchema>

/**
  Fetch the config file for the project and validate it.
  */
export const getTanstackDocsConfig = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({ repo: v.string(), branch: v.string(), docsRoot: v.string() }),
  )
  .handler(async ({ data: { repo, branch, docsRoot } }) => {
    const config = await fetchRepoFile(repo, branch, `${docsRoot}/config.json`)

    if (!config) {
      throw new Error(`Repo's ${docsRoot}/config.json was not found!`)
    }

    try {
      const tanstackDocsConfigFromJson = JSON.parse(config)
      const validationResult = v.safeParse(
        configSchema,
        tanstackDocsConfigFromJson,
      )

      if (!validationResult.success) {
        // Log the issues that come up during validation
        console.error(JSON.stringify(validationResult.issues, null, 2))
        throw new Error('Valibot validation failed')
      }

      setResponseHeaders(
        new Headers({
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Netlify-CDN-Cache-Control':
            'public, max-age=300, durable, stale-while-revalidate=300',
        }),
      )

      return validationResult.output
    } catch (e) {
      console.error(e)
      throw new Error('Invalid docs/config.json file', { cause: e })
    }
  })
