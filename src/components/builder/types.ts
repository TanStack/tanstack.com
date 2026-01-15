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
  | 'data'
  | 'ui'
  | 'tooling'
  | 'deployment'
  | 'example'

// Category metadata for display
export const ADD_ON_CATEGORIES: Record<
  AddOnCategory,
  { label: string; description: string }
> = {
  database: {
    label: 'Database',
    description: 'Database clients and ORMs',
  },
  auth: {
    label: 'Authentication',
    description: 'User authentication and authorization',
  },
  data: {
    label: 'Data & APIs',
    description: 'Data fetching, state management, and API integrations',
  },
  ui: {
    label: 'UI & Forms',
    description: 'Component libraries, forms, and styling',
  },
  tooling: {
    label: 'Tooling',
    description: 'Development tools, testing, and utilities',
  },
  deployment: {
    label: 'Deployment',
    description: 'Hosting and deployment platforms',
  },
  example: {
    label: 'Examples',
    description: 'Example code and templates',
  },
}

// Explicit category overrides for specific add-on IDs
const ADDON_CATEGORY_OVERRIDES: Record<string, AddOnCategory> = {
  // Database
  neon: 'database',
  drizzle: 'database',
  prisma: 'database',
  convex: 'database',
  turso: 'database',

  // Auth
  clerk: 'auth',
  workos: 'auth',

  // Data & APIs
  query: 'data',
  'tanstack-query': 'data',
  'apollo-client': 'data',
  trpc: 'data',
  orpc: 'data',
  store: 'data',
  'tanstack-store': 'data',
  ai: 'data',

  // UI & Forms
  shadcn: 'ui',
  form: 'ui',
  'tanstack-form': 'ui',
  table: 'ui',
  'tanstack-table': 'ui',

  // Tooling
  biome: 'tooling',
  eslint: 'tooling',
  sentry: 'tooling',
  storybook: 'tooling',
  compiler: 'tooling',
  't3-env': 'tooling',
  t3env: 'tooling',
  paraglide: 'tooling',
  mcp: 'tooling',
  strapi: 'tooling',

  // Deployment
  netlify: 'deployment',
  cloudflare: 'deployment',
  vercel: 'deployment',
  nitro: 'deployment',
}

// Map add-on type from CTA to our categories
export function getAddOnCategory(type: string, id: string): AddOnCategory {
  const idLower = id.toLowerCase()

  // Check explicit overrides first
  if (ADDON_CATEGORY_OVERRIDES[idLower]) {
    return ADDON_CATEGORY_OVERRIDES[idLower]
  }

  // Check type field from CTA
  switch (type) {
    case 'deployment':
      return 'deployment'
    case 'toolchain':
      return 'tooling'
    case 'example':
      return 'example'
  }

  // Fallback: infer from ID patterns
  if (
    idLower.includes('auth') ||
    idLower.includes('clerk') ||
    idLower.includes('lucia')
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
    idLower.includes('neon') ||
    idLower.includes('db')
  ) {
    return 'database'
  }

  if (
    idLower.includes('query') ||
    idLower.includes('apollo') ||
    idLower.includes('trpc') ||
    idLower.includes('orpc') ||
    idLower.includes('store')
  ) {
    return 'data'
  }

  if (
    idLower.includes('shadcn') ||
    idLower.includes('radix') ||
    idLower.includes('form') ||
    idLower.includes('table')
  ) {
    return 'ui'
  }

  if (
    idLower.includes('eslint') ||
    idLower.includes('prettier') ||
    idLower.includes('biome') ||
    idLower.includes('test') ||
    idLower.includes('vitest') ||
    idLower.includes('sentry') ||
    idLower.includes('storybook') ||
    idLower.includes('compiler')
  ) {
    return 'tooling'
  }

  if (
    idLower.includes('vercel') ||
    idLower.includes('netlify') ||
    idLower.includes('cloudflare') ||
    idLower.includes('docker') ||
    idLower.includes('nitro')
  ) {
    return 'deployment'
  }

  // Default to tooling instead of "other" since most uncategorized things are tools
  return 'tooling'
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
// These match the CTA WebContainer store states
export type SetupStep =
  | 'idle'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error'

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  idle: 'Waiting...',
  mounting: 'Mounting files...',
  installing: 'Installing dependencies...',
  starting: 'Starting dev server...',
  ready: 'Ready',
  error: 'Error',
}
