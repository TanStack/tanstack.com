declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    HYPERDRIVE?: {
      connectionString: string
    }
  }
}
