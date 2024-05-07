import { execSync } from 'child_process'
import path from 'path'

const packages = {
  //   '@tanstack/react-router': 'router/packages/react-router',
  //   '@tanstack/router-devtools': 'router/packages/router-devtools',
  '@tanstack/react-router-server': 'router/packages/react-router-server',
  //   '@tanstack/react-cross-context': 'router/packages/react-cross-context',
  //   '@tanstack/history': 'router/packages/history',
  //   '@tanstack/react-store':
  //     'router/packages/react-router/node_modules/@tanstack/react-store',
  //   '@tanstack/router-vite-plugin': 'router/packages/router-vite-plugin',
  //   '@tanstack/router-generator': 'router/packages/router-generator',
}

const projectDir = process.cwd()
const baseDir = path.resolve(process.cwd(), '..') // Uses the current working directory

try {
  Object.entries(packages).forEach(([packageName, packagePath]) => {
    const fullPath = path.join(baseDir, packagePath)
    console.log(`Linking ${packageName} from ${fullPath}`)
    execSync(`cd "${fullPath}" && pnpm link --global`, { stdio: 'inherit' })
  })

  console.log(`Linking packages to project at ${projectDir}`)
  Object.keys(packages).forEach((packageName) => {
    execSync(`cd "${projectDir}" && pnpm link --global ${packageName}`, {
      stdio: 'inherit',
    })
  })

  console.log('All packages linked successfully!')
} catch (error) {
  console.error('Failed to link packages:', error)
}
