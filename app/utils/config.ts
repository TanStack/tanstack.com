import { z } from 'zod'
import { fetchRepoFile } from './documents.server'

export type FrameworkMenu = {
  framework: string
  menuItems: MenuItem[]
}

export type MenuItem = {
  name: string | React.ReactNode
  items: {
    label: string | React.ReactNode
    to: string
    badge?: string
  }[]
}

const itemSchema = z.object({
  label: z.string(),
  to: z.string(),
  badge: z.string().optional(),
})

const configSchema = z.object({
  docSearch: z.object({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string(),
  }),
  sections: z.array(
    z.object({
      name: z.string(),
      items: z.array(itemSchema),
      frameworks: z.array(
        z.object({
          name: z.string(),
          items: z.array(itemSchema),
        })
      ),
    })
  ),
  users: z.array(z.string()).optional(),
})

export type ConfigSchema = z.infer<typeof configSchema>

/**
  Fetch the config file for the project and validate it.
  */
export async function getTanstackDocsConfig(repo: string, branch: string) {
  const config = await fetchRepoFile(repo, branch, `docs/config.json`)

  if (!config) {
    throw new Error('Repo docs/config.json not found!')
  }

  try {
    const tanstackDocsConfigFromJson = JSON.parse(config)
    const validationResult = configSchema.safeParse(tanstackDocsConfigFromJson)

    if (!validationResult.success) {
      // Log the issues that come up during validation
      console.error(JSON.stringify(validationResult.error, null, 2))
      throw new Error('Zod validation failed')
    }

    return validationResult.data
  } catch (e) {
    throw new Error('Invalid docs/config.json file')
  }
}
