/**
 * Environment variable utility that works in both TanStack Start and Netlify functions
 * Uses process.env when import.meta is not available (Netlify functions)
 */

function getEnvVar(key: string): string | undefined {
  // In Netlify functions, import.meta is not available, so use process.env
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) {
      return process.env[key]
    }

    // In TanStack Start, prefer import.meta.env but fallback to process.env for server-only vars
    if (import.meta.env.SSR) {
      return process.env[key] ?? import.meta.env[key]
    }

    return import.meta.env[key]
  } catch {
    // import.meta not available (e.g., in Netlify functions CJS build)
    return process.env[key]
  }
}

export const envFunctions = {
  GITHUB_AUTH_TOKEN:
    getEnvVar('GITHUB_AUTH_TOKEN') || 'USE_A_REAL_KEY_IN_PRODUCTION',
  GITHUB_WEBHOOK_SECRET: getEnvVar('GITHUB_WEBHOOK_SECRET'),
  GITHUB_OAUTH_CLIENT_ID: getEnvVar('GITHUB_OAUTH_CLIENT_ID'),
  GITHUB_OAUTH_CLIENT_SECRET: getEnvVar('GITHUB_OAUTH_CLIENT_SECRET'),
  GOOGLE_OAUTH_CLIENT_ID: getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
  GOOGLE_OAUTH_CLIENT_SECRET: getEnvVar('GOOGLE_OAUTH_CLIENT_SECRET'),
  SITE_URL: getEnvVar('SITE_URL'),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  SESSION_SECRET: getEnvVar('SESSION_SECRET'),
  URL: getEnvVar('URL'),
} as const
