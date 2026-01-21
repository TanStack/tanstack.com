import { resolve } from 'node:path'

const LOCAL_INTEGRATIONS_PATH = resolve(process.cwd(), '../cli/integrations')
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/TanStack/cli/main/integrations'

export function getAddonsBasePath() {
  // Use local path in development, GitHub in production
  if (process.env.NODE_ENV === 'development') {
    return LOCAL_INTEGRATIONS_PATH
  }
  return GITHUB_RAW_BASE
}
