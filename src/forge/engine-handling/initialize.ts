import { register } from '@tanstack/cta-framework-react-cra'

import { setServerEnvironment } from './server-environment'

let initialized = false

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

export function initialize() {
  if (initialized) return
  initialized = true

  register()
}
