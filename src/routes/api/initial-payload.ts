import { createFileRoute } from '@tanstack/react-router'
import { registerFramework } from '@tanstack/cta-engine'
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'
import { generateInitialPayload } from '@tanstack/cta-ui/lib/engine-handling/generate-initial-payload'
import { setServerEnvironment } from '@tanstack/cta-ui/lib/engine-handling/server-environment'

// Register the React CRA framework before using CTA engine
registerFramework(createFrameworkDefinition())

// Configure server environment for TanStack Start builder mode
setServerEnvironment({
  projectPath: process.cwd(),
  options: {
    targetDir: './',
    projectName: 'my-app',
    mode: 'file-router',
    typescript: true,
    tailwind: true,
    git: false,
    packageManager: 'pnpm',
    chosenAddOns: [],
    framework: 'react-cra',
    addOnOptions: {},
  },
  mode: 'setup',
  forcedRouterMode: 'file-router',
  forcedAddOns: ['start'],
  showDeploymentOptions: true,
})

export const Route = createFileRoute('/api/initial-payload')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async () => {
        try {
          const payload = await generateInitialPayload()

          // Ensure chosenAddOns is always an array to avoid client-side iteration bug
          if (payload.options && !Array.isArray(payload.options.chosenAddOns)) {
            payload.options.chosenAddOns = []
          }

          return new Response(JSON.stringify(payload), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Error generating initial payload:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to generate initial payload' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
