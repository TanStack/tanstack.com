import { z } from "zod"
import { createApp, createMemoryEnvironment, getFrameworkById, registerFramework } from "@tanstack/cta-engine"
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'

registerFramework(createFrameworkDefinition())

const requestOptionsSchema: z.ZodTypeAny = z.object({
  projectName: z.string(),
  mode: z.enum(["file-router", "code-router"]),
  framework: z.enum(["react-cra", "solid"]),
  typescript: z.boolean(),
  tailwind: z.boolean(),
  chosenAddOns: z.array(z.any()),
})

export const ServerRoute = createServerFileRoute().methods({
  POST: async ({ request }) => {
    const body = await request.json()
    const validationResult = requestOptionsSchema.safeParse(body.options)
    if (!validationResult.success) {
      return new Response(JSON.stringify(validationResult.error), {
        status: 400,
      })
    }

    const framework = getFrameworkById(validationResult.data.framework)!
    const { environment, output } = createMemoryEnvironment()
    const createAppOptions = Object.assign({
      projectName: "dry-run-create-app",
      targetDir: "./",
      mode: "file-router",
      typescript: false,
      tailwind: false,
      packageManager: "pnpm",
      git: false,
      chosenAddOns: []
    }, validationResult.data, { framework })

    await createApp(environment, createAppOptions)

    for (const [outputPath, content] of Object.entries(output.files)) {
      const normalizedOutputPath = outputPath.replace(process.cwd(), '.')
      output.files[normalizedOutputPath] = content
      delete output.files[outputPath]
    }

    return new Response(JSON.stringify(output))
  },
})