declare module 'cloudflare:workers' {
  export const WorkflowEntrypoint: typeof import('@cloudflare/workers-types').CloudflareWorkersModule.WorkflowEntrypoint
  export type WorkflowEvent<T> =
    import('@cloudflare/workers-types').CloudflareWorkersModule.WorkflowEvent<T>
  export type WorkflowStep =
    import('@cloudflare/workers-types').CloudflareWorkersModule.WorkflowStep
  export const DurableObject: typeof import('@cloudflare/workers-types').CloudflareWorkersModule.DurableObject
  export const env: Record<string, unknown> & {
    GITHUB_AUTH_TOKEN?: string
    GITHUB_CONTENT_CACHE?: unknown
    HYPERDRIVE?: {
      connectionString: string
    }
    NPM_DOWNLOAD_CACHE?: unknown
    BUILDER_PROJECTS?: unknown
  }
}
