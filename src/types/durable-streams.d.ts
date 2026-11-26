import type { Request, Response } from '@cloudflare/workers-types'
import '@durable-streams/server-cloudflare'

declare module '@durable-streams/server-cloudflare' {
  // The package emits DOM Request types, but this entrypoint runs in workerd
  // and accepts the platform's Request, including its Cloudflare properties.
  interface StreamObject {
    fetch(request: Request): Promise<Response>
  }
}
