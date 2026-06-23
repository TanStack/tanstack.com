declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    GITHUB_CONTENT_CACHE?: unknown
    HYPERDRIVE?: {
      connectionString: string
    }
    NPM_DOWNLOAD_CACHE?: unknown
  }
}
