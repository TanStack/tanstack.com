import type { FileEnvironment } from './saved-files'
import type { ProviderEnv } from './providers'
import type {
  DurableObjectNamespace,
  Workflow,
} from '@cloudflare/workers-types'
import type { StreamObject } from '@durable-streams/server-cloudflare'
import type { Conversation } from './conversation'
import type { WorkspaceSync } from './workspace-sync-object'
import type { WorkflowDriverParams } from './workflow-driver'

/** Source runtime bindings, with shared PostgreSQL replacing the original D1 binding. */
export interface ConversationEnvironment extends ProviderEnv {
  FILES: FileEnvironment['FILES']
  APP_MODE: string
  GUM_DEV_EXECUTION: string
  MCP_EGRESS_MODE: string
  MCP_EGRESS_URL: string
  MCP_EGRESS_TOKEN: string
  KODY_ORIGIN: string
  ENCRYPTION_KEY: string
  TYPESAFE_API_KEY: string
  UNLIMITED_USAGE_EMAILS?: string
  GUM_FIXTURE_DELAY_MS?: string
  USAGE_RATES_JSON?: string
  STREAMS: DurableObjectNamespace<StreamObject>
  WORKSPACE_SYNC: DurableObjectNamespace<WorkspaceSync>
  CONVERSATIONS: DurableObjectNamespace<Conversation>
  WORKFLOW_RUNS: Workflow<WorkflowDriverParams>
}
