import { execSync } from 'child_process'
import path from 'path'

const packages = {
  '@tanstack/history': 'router/packages/history',
  '@tanstack/react-cross-context': 'router/packages/react-cross-context',
  '@tanstack/react-router': 'router/packages/react-router',
  '@tanstack/router-cli': 'router/packages/router-cli',
  '@tanstack/router-devtools': 'router/packages/router-devtools',
  '@tanstack/router-generator': 'router/packages/router-generator',
  '@tanstack/virtual-file-routes': 'router/packages/virtual-file-routes',
  '@tanstack/router-plugin': 'router/packages/router-plugin',
  '@tanstack/router-vite-plugin': 'router/packages/router-vite-plugin',
  '@tanstack/react-router-with-query':
    'router/packages/react-router-with-query',
  '@tanstack/zod-adapter': 'router/packages/zod-adapter',
  '@tanstack/valibot-adapter': 'router/packages/valibot-adapter',
  '@tanstack/arktype-adapter': 'router/packages/arktype-adapter',
  '@tanstack/start': 'router/packages/start',
  '@tanstack/start-client': 'router/packages/start-client',
  '@tanstack/start-server': 'router/packages/start-server',
  '@tanstack/start-api-routes': 'router/packages/start-api-routes',
  '@tanstack/start-server-functions-fetcher':
    'router/packages/start-server-functions-fetcher',
  '@tanstack/start-server-functions-handler':
    'router/packages/start-server-functions-handler',
  '@tanstack/start-server-functions-client':
    'router/packages/start-server-functions-client',
  '@tanstack/start-server-functions-ssr':
    'router/packages/start-server-functions-ssr',
  '@tanstack/start-server-functions-server':
    'router/packages/start-server-functions-server',
  '@tanstack/start-router-manifest': 'router/packages/start-router-manifest',
  '@tanstack/start-config': 'router/packages/start-config',
  '@tanstack/start-plugin': 'router/packages/start-plugin',
  '@tanstack/eslint-plugin-router': 'router/packages/eslint-plugin-router',
  '@tanstack/server-functions-plugin':
    'router/packages/server-functions-plugin',
  '@tanstack/directive-functions-plugin':
    'router/packages/directive-functions-plugin',
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
