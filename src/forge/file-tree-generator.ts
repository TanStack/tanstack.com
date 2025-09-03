/**
 * Converts TanStack Router file paths to their corresponding route paths
 * Based on TanStack Router file-based routing conventions
 */
function convertRoutePathToUrl(filePath: string): string {
  // Remove src/routes/ prefix and file extension
  let routePath = filePath
    .replace(/^src\/routes\//, '')
    .replace(/\.(tsx?|ts)$/, '')

  // Handle special cases
  if (routePath === '__root') return 'Root layout'
  if (routePath === 'index') return '/'

  // Handle API routes
  if (routePath.startsWith('api.')) {
    return '/api/' + routePath.substring(4).replace(/\./g, '/')
  }

  // Handle parameter routes ($paramName)
  routePath = routePath.replace(/\$([^./]+)/g, ':$1')

  // Handle flat routing (dots to slashes)
  routePath = routePath.replace(/\./g, '/')

  // Ensure leading slash
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath
  }

  return routePath
}

/**
 * Gets a description for a file based on its path and type
 */
function getFileDescription(filePath: string): string {
  const fileName = filePath.split('/').pop() || ''

  // Route files
  if (filePath.startsWith('src/routes/')) {
    const routePath = convertRoutePathToUrl(filePath)

    if (fileName === '__root.tsx') return '# Root layout'
    if (fileName === 'index.tsx') return '# Home page'
    if (filePath.includes('api.')) return `# API endpoint: ${routePath}`
    return `# Route: ${routePath}`
  }

  // Other common files
  if (fileName === 'router.tsx') return '# Router configuration'
  if (fileName === 'routeTree.gen.ts') return '# Generated route tree'
  if (fileName === 'styles.css') return '# Global styles'
  if (fileName === 'vite.config.ts') return '# Vite configuration'
  if (fileName === 'package.json') return '# Project dependencies'
  if (fileName === 'tsconfig.json') return '# TypeScript configuration'
  if (fileName === 'components.json') return '# Component configuration'
  if (filePath.startsWith('src/components/')) return '# Components directory'
  if (filePath.startsWith('src/lib/')) return '# Utility functions'
  if (filePath.startsWith('convex/')) return '# Convex backend'
  if (filePath.startsWith('public/')) return '# Static asset'

  return ''
}

/**
 * Generates a tree structure representation of files
 */
function generateFileTree(projectFilesObj: Record<string, string>): string {
  const files = Object.keys(projectFilesObj).sort()

  // Build directory structure
  const tree: Record<string, any> = {}

  files.forEach((filePath) => {
    const parts = filePath.split('/')
    let current = tree

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // It's a file
        current[part] = {
          type: 'file',
          path: filePath,
        }
      } else {
        // It's a directory
        if (!current[part]) {
          current[part] = {
            type: 'directory',
            children: {},
          }
        }
        current = current[part].children
      }
    })
  })

  // Generate tree string
  function buildTreeString(
    node: any,
    prefix: string = '',
    isLast: boolean = true,
    name: string = '.',
  ): string {
    let result = ''

    if (name !== '.') {
      const connector = isLast ? '└── ' : '├── '
      const description =
        node.type === 'file' ? getFileDescription(node.path) : ''
      const displayName = node.type === 'directory' ? `${name}/` : name

      result += `${prefix}${connector}${displayName}`
      if (description) {
        // Calculate padding to align descriptions
        const baseLength = 40
        const currentLength =
          prefix.length + connector.length + displayName.length
        const padding = Math.max(1, baseLength - currentLength)
        result += ' '.repeat(padding) + description
      }
      result += '\n'
    }

    if (node.type === 'directory' || name === '.') {
      const children = node.children || node
      const entries = Object.entries(children).sort(
        ([a, aNode]: [string, any], [b, bNode]: [string, any]) => {
          // Directories first, then files
          if (aNode.type !== bNode.type) {
            return aNode.type === 'directory' ? -1 : 1
          }
          return a.localeCompare(b)
        },
      )

      entries.forEach(([childName, childNode], index) => {
        const isLastChild = index === entries.length - 1
        const newPrefix =
          name === '.' ? '' : prefix + (isLast ? '    ' : '│   ')
        result += buildTreeString(childNode, newPrefix, isLastChild, childName)
      })
    }

    return result
  }

  return buildTreeString(tree).trim()
}

export { generateFileTree, convertRoutePathToUrl, getFileDescription }
