import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  createApp,
  createMemoryEnvironment,
  getFrameworkById,
  registerFramework,
} from '@tanstack/cta-engine'
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'

registerFramework(createFrameworkDefinition())

const requestOptionsSchema = z.object({
  projectName: z.string(),
  mode: z.enum(['file-router', 'code-router']),
  framework: z.enum(['react-cra', 'solid']),
  typescript: z.boolean(),
  tailwind: z.boolean(),
  chosenAddOns: z.array(z.unknown()),
})

export const Route = createFileRoute('/api/dry-run-create-app')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json()
        const validationResult = requestOptionsSchema.safeParse(body.options)

        if (!validationResult.success) {
          return new Response(JSON.stringify(validationResult.error), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const framework = getFrameworkById(validationResult.data.framework)
        if (!framework) {
          return new Response(
            JSON.stringify({ error: 'Framework not found' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        const { environment, output } = createMemoryEnvironment()
        const createAppOptions = {
          targetDir: './',
          packageManager: 'pnpm' as const,
          git: false,
          projectName: validationResult.data.projectName,
          mode: validationResult.data.mode,
          typescript: validationResult.data.typescript,
          tailwind: validationResult.data.tailwind,
          chosenAddOns: validationResult.data.chosenAddOns as never[],
          framework,
        }

        await createApp(environment, createAppOptions as never)

        for (const [outputPath, content] of Object.entries(output.files)) {
          const normalizedOutputPath = outputPath.replace(process.cwd(), '.')
          output.files[normalizedOutputPath] = content
          delete output.files[outputPath]
        }

        return new Response(JSON.stringify(output), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
