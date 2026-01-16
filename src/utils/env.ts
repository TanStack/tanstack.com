import * as v from 'valibot'

// Define server-only schema
const serverEnvSchema = v.object({
  GITHUB_AUTH_TOKEN: v.optional(v.string(), 'USE_A_REAL_KEY_IN_PRODUCTION'),
  GITHUB_WEBHOOK_SECRET: v.optional(v.string()),
  GITHUB_OAUTH_CLIENT_ID: v.optional(v.string()),
  GITHUB_OAUTH_CLIENT_SECRET: v.optional(v.string()),
  GOOGLE_OAUTH_CLIENT_ID: v.optional(v.string()),
  GOOGLE_OAUTH_CLIENT_SECRET: v.optional(v.string()),
  SITE_URL: v.optional(v.string()), // Base URL for OAuth redirects (e.g., https://tanstack.com or http://localhost:3000)
  DATABASE_URL: v.optional(v.string()),
  SESSION_SECRET: v.optional(v.string()), // Secret key for signing session cookies (required in production)
  DISCORD_WEBHOOK_URL: v.optional(v.string()),
  RESEND_API_KEY: v.optional(v.string()),
  POSTHOG_API_KEY: v.optional(v.string()),
  SENTRY_DSN: v.optional(v.string()),
  TANSTACK_MCP_ENABLED_TOOLS: v.optional(v.string()),
})

const clientEnvSchema = v.object({
  URL: v.optional(v.string()),
})

// Validate and parse environment variables
const parsedServerEnv = import.meta.env.SSR
  ? v.parse(serverEnvSchema, process.env)
  : {}

const parsedClientEnv = import.meta.env
  ? v.parse(clientEnvSchema, import.meta.env)
  : {}

type ParsedServerEnv = v.InferOutput<typeof serverEnvSchema>
type ParsedClientEnv = v.InferOutput<typeof clientEnvSchema>
type ParsedEnv = ParsedServerEnv & ParsedClientEnv

// Merge parsed environments, with server env hidden from client
export const env = new Proxy(
  import.meta.env.SSR
    ? { ...parsedClientEnv, ...parsedServerEnv }
    : parsedClientEnv,
  {
    get(target, prop) {
      if (prop in parsedServerEnv && typeof window !== 'undefined') {
        throw new Error(
          `Access to server-only environment variable '${String(
            prop,
          )}' from client code is not allowed.`,
        )
      }
      return prop in parsedServerEnv
        ? parsedServerEnv[prop as keyof typeof parsedServerEnv]
        : target[prop as keyof typeof parsedClientEnv]
    },
  },
) as ParsedEnv
