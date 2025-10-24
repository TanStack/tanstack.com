import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/initial-payload')({
  server: {
    handlers: {
      GET: async () => {
        // Import server-only modules inside the handler to prevent client bundling
        const { generateInitialPayload } = await import(
          '~/cta/lib/engine-handling/generate-initial-payload'
        )
        const { setServerEnvironment } = await import(
          '~/cta/lib/engine-handling/server-environment'
        )

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
          },
          mode: 'setup',
        })

        const payload = await generateInitialPayload()
        return new Response(JSON.stringify(payload))
      },
    },
  },
})
