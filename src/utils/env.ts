import { z } from 'zod'

// Define server-only schema
const serverEnvSchema = z.object({
  GITHUB_AUTH_TOKEN: z.string().default('USE_A_REAL_KEY_IN_PRODUCTION'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  SITE_URL: z.string().optional(), // Base URL for OAuth redirects (e.g., https://tanstack.com or http://localhost:3000)
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().optional(), // Secret key for signing session cookies (required in production)
})

const clientEnvSchema = z.object({
  URL: z.string().optional(),
})

// Validate and parse environment variables
const parsedServerEnv = import.meta.env.SSR
  ? serverEnvSchema.parse(process.env)
  : {}

const parsedClientEnv = import.meta.env
  ? clientEnvSchema.parse(import.meta.env)
  : {}

type ParsedServerEnv = z.infer<typeof serverEnvSchema>
type ParsedClientEnv = z.infer<typeof clientEnvSchema>
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
