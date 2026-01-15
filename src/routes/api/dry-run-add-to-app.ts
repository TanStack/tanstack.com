import { createFileRoute } from '@tanstack/react-router'
import { registerFramework } from '@tanstack/cta-engine'
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'
import { addToAppWrapper } from '@tanstack/cta-ui/lib/engine-handling/add-to-app-wrapper'

// Ensure framework is registered
registerFramework(createFrameworkDefinition())

export const Route = createFileRoute('/api/dry-run-add-to-app')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await request.json()

        try {
          const output = await addToAppWrapper(body.addOns, {
            dryRun: true,
          })

          return new Response(JSON.stringify(output), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch {
          return new Response(
            JSON.stringify({
              files: {},
              commands: [],
              deletedFiles: [],
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
