/**
 * Shared types for the Builder UI components
 */

// URL search params for shareable builder state
export type BuilderSearchParams = {
  name?: string
  mode?: 'file-router' | 'code-router'
  ts?: boolean
  tw?: boolean
  starter?: string
  addons?: string // comma-separated addon IDs
}

// Add-on categories for grouping in the UI
export type AddOnCategory =
  | 'auth'
  | 'database'
  | 'ui'
  | 'tooling'
  | 'deployment'
  | 'example'
  | 'other'

// Category metadata for display
export const ADD_ON_CATEGORIES: Record<
  AddOnCategory,
  { label: string; description: string }
> = {
  auth: {
    label: 'Authentication',
    description: 'User authentication and authorization',
  },
  database: {
    label: 'Database',
    description: 'Database clients and ORMs',
  },
  ui: {
    label: 'UI Components',
    description: 'Component libraries and styling',
  },
  tooling: {
    label: 'Tooling',
    description: 'Development tools and utilities',
  },
  deployment: {
    label: 'Deployment',
    description: 'Hosting and deployment platforms',
  },
  example: {
    label: 'Examples',
    description: 'Example code and templates',
  },
  other: {
    label: 'Other',
    description: 'Additional add-ons',
  },
}

// Map add-on type from CTA to our categories
export function getAddOnCategory(type: string, id: string): AddOnCategory {
  // First check the type field
  switch (type) {
    case 'deployment':
      return 'deployment'
    case 'toolchain':
      return 'tooling'
    case 'example':
      return 'example'
  }

  // Fallback: infer from ID patterns
  const idLower = id.toLowerCase()

  if (
    idLower.includes('auth') ||
    idLower.includes('clerk') ||
    idLower.includes('lucia') ||
    idLower.includes('supabase-auth')
  ) {
    return 'auth'
  }

  if (
    idLower.includes('drizzle') ||
    idLower.includes('prisma') ||
    idLower.includes('convex') ||
    idLower.includes('supabase') ||
    idLower.includes('postgres') ||
    idLower.includes('sqlite') ||
    idLower.includes('turso') ||
    idLower.includes('db')
  ) {
    return 'database'
  }

  if (
    idLower.includes('shadcn') ||
    idLower.includes('radix') ||
    idLower.includes('ui') ||
    idLower.includes('component')
  ) {
    return 'ui'
  }

  if (
    idLower.includes('eslint') ||
    idLower.includes('prettier') ||
    idLower.includes('biome') ||
    idLower.includes('test') ||
    idLower.includes('vitest')
  ) {
    return 'tooling'
  }

  if (
    idLower.includes('vercel') ||
    idLower.includes('netlify') ||
    idLower.includes('cloudflare') ||
    idLower.includes('docker')
  ) {
    return 'deployment'
  }

  return 'other'
}

// File tree node structure (converted from flat file map)
export type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  depth: number
}

// Convert flat file map to tree structure
export function filesToTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const paths = Object.keys(files).sort()

  for (const filePath of paths) {
    const parts = filePath.replace(/^\.\//, '').split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let existing = currentLevel.find((n) => n.name === part)

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          depth: i,
          children: isFile ? undefined : [],
        }
        currentLevel.push(existing)
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }))
  }

  return sortNodes(root)
}

// Generate CLI command from options
export function generateCliCommand(options: {
  projectName: string
  mode: string
  typescript: boolean
  tailwind: boolean
  addons: string[]
  starter?: string
}): string {
  const args = [`npx create-tanstack-app@latest ${options.projectName}`]

  if (options.mode === 'code-router') {
    args.push('--mode code-router')
  }

  if (!options.typescript) {
    args.push('--no-typescript')
  }

  if (!options.tailwind) {
    args.push('--no-tailwind')
  }

  if (options.starter) {
    args.push(`--starter ${options.starter}`)
  }

  if (options.addons.length > 0) {
    args.push(`--add-ons ${options.addons.join(',')}`)
  }

  return args.join(' \\\n  ')
}

// Explorer panel tab type
export type ExplorerTab = 'files' | 'preview'

// WebContainer setup steps for progress display
export type SetupStep =
  | 'idle'
  | 'booting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error'

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  idle: 'Waiting...',
  booting: 'Booting WebContainer...',
  installing: 'Installing dependencies...',
  starting: 'Starting dev server...',
  ready: 'Ready',
  error: 'Error',
}
