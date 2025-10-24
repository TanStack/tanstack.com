import { setServerEnvironment } from './server-environment'

let initialized = false

export async function initialize() {
  if (initialized) return
  initialized = true

  // Dynamically import CTA framework to prevent client bundling
  const { register } = await import('@tanstack/cta-framework-react-cra')

  setServerEnvironment({
    projectPath: './',
    mode: 'setup',
    addOns: [],
    options: {
      framework: 'react-cra',
      projectName: 'test',
      typescript: true,
      tailwind: true,
      targetDir: './',
      packageManager: 'pnpm',
      git: true,
      mode: 'file-router',
      chosenAddOns: [],
      starter: undefined,
    },
    forcedRouterMode: undefined,
    forcedAddOns: ['start'],
    registry: undefined,
  })

  register()
}
