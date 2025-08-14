import { z } from 'zod'

// Define server-only schema
const serverEnvSchema = z.object({
  GITHUB_AUTH_TOKEN: z.string().default('USE_A_REAL_KEY_IN_PRODUCTION'),
  AIRTABLE_API_KEY: z.string().optional(),
  // Better Auth OAuth credentials
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  // Convex is used for auth database
  CONVEX_URL: z.string().optional(),
})

// Define client schema
const viteEnvSchema = z.object({
  // Remove Clerk, add any Better Auth client vars if needed
  // VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
})

// Validate and parse environment variables
const parsedServerEnv = import.meta.env.SSR
  ? serverEnvSchema.parse(process.env)
  : {}
const parsedClientEnv = viteEnvSchema.parse(import.meta.env)

type ParsedServerEnv = z.infer<typeof serverEnvSchema>
type ParsedClientEnv = z.infer<typeof viteEnvSchema>
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
            prop
          )}' from client code is not allowed.`
        )
      }
      return prop in parsedServerEnv
        ? parsedServerEnv[prop as keyof typeof parsedServerEnv]
        : target[prop as keyof typeof parsedClientEnv]
    },
  }
) as ParsedEnv
