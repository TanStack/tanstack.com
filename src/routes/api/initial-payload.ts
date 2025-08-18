import { generateInitialPayload } from "@tanstack/cta-ui/lib/engine-handling/generate-initial-payload"
import { setServerEnvironment } from "@tanstack/cta-ui/lib/engine-handling/server-environment"

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

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    const payload = await generateInitialPayload()
    return new Response(JSON.stringify(payload))
  },
})