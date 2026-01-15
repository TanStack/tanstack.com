import { createFileRoute } from '@tanstack/react-router'
import { generateInitialPayload } from '@tanstack/cta-ui/lib/engine-handling/generate-initial-payload'
import { setServerEnvironment } from '@tanstack/cta-ui/lib/engine-handling/server-environment'

setServerEnvironment({
  projectPath: process.cwd(),
  options: {
    targetDir: './',
    projectName: 'dry-run-create-app',
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
})

export const Route = createFileRoute('/api/initial-payload')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async () => {
        const payload = await generateInitialPayload()
        return new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
