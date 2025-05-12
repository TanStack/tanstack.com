import { z } from 'zod'

// Define server-only schema
const serverEnvSchema = z.object({
  GITHUB_AUTH_TOKEN: z.string().default('USE_A_REAL_KEY_IN_PRODUCTION'),
  AIRTABLE_API_KEY: z.string().optional(),
})

// Define client schema
const viteEnvSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
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
