import { z } from "zod"
import { createApp, finalizeAddOns, getFrameworkById, loadStarter, registerFramework, Starter } from "@tanstack/cta-engine"
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'
import { createMemoryEnvironment } from "~/cta/lib/engine-handling/memory-environment"

registerFramework(createFrameworkDefinition())

const requestOptionsSchema = z.object({
  starter: z.string().optional(),
  projectName: z.string(),
  mode: z.enum(["file-router", "code-router"]),
  framework: z.enum(["react-cra", "solid"]),
  typescript: z.boolean(),
  tailwind: z.boolean(),
  chosenAddOns: z.array(z.string()),
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

    
    let starter: Starter | undefined
    const addOns: Array<string> = [...createAppOptions.chosenAddOns]
    if (createAppOptions.starter) {
      starter = await loadStarter(createAppOptions.starter)
      if (starter)
        for (const addOn of starter.dependsOn ?? []) {
          addOns.push(addOn)
        }
    }
    
    const chosenAddOns = await finalizeAddOns(
      framework,
      createAppOptions.mode,
      addOns,
    )

    await createApp(environment, {
      ...createAppOptions,
      chosenAddOns,
    })

    // Call finishRun to populate the output files
    environment.finishRun()

    for (const [outputPath, content] of Object.entries(output.files)) {
      const normalizedOutputPath = outputPath.replace(process.cwd(), '.')
      output.files[normalizedOutputPath] = content
      delete output.files[outputPath]
    }

    return new Response(JSON.stringify(output))
  },
})