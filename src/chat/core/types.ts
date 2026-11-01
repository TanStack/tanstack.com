import { z } from 'zod'
export const providers = [
  'included',
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'grok',
  'openrouter',
  'vercel',
  'cloudflare',
  'cf_gateway',
  'compatible',
] as const
export type Provider = (typeof providers)[number]
export const policySchema = z.object({
  allowedProviders: z.array(z.enum(providers)).min(1),
  allowedModels: z.array(z.string()).default([]),
  dailyTurns: z.number().int().min(1).max(200),
  allowJev: z.boolean(),
  allowChatModels: z.boolean().default(true),
  allowKody: z.boolean(),
  allowMcp: z.boolean().default(true),
})
export type Policy = z.infer<typeof policySchema>
export const defaultPolicy: Policy = {
  allowedProviders: [...providers],
  allowedModels: [],
  dailyTurns: 30,
  allowJev: true,
  allowChatModels: true,
  allowKody: true,
  allowMcp: true,
}
export const connectionSchema = z.object({
  provider: z.enum(providers),
  model: z.string().max(150),
  apiKey: z.string().max(4000).optional(),
  accountId: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .or(z.literal(''))
    .default(''),
  gatewayId: z
    .string()
    .regex(/^[\w-]{0,100}$/)
    .default(''),
  baseUrl: z.string().max(300).default(''),
})
export type Connection = z.infer<typeof connectionSchema>
export interface Tokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  client_id: string
}
export const mcpServerSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().min(1).max(500),
    accessToken: z.string().max(4000).optional(),
    enabled: z.boolean().default(true),
  })
  .strict()
export type SavedMcpServer = Omit<z.infer<typeof mcpServerSchema>, 'id'> & {
  id: string
  credentialId?: string
}
export interface Credentials {
  mcpServers?: SavedMcpServer[]
  kody?: Tokens
  connection: Connection
  connections?: Partial<Record<Provider, Connection>>
}
export interface Bot {
  avatar?: string | null
  id: string
  workspace_id: string
  parent_id: string | null
  name: string
  purpose: string
  created_at: number
}
export interface Recipe {
  id: string
  workspace_id: string
  title: string
  description: string
  code: string
  created_at: number
}
export interface Trace {
  id: string
  time: number
  kind: 'route' | 'model' | 'tool' | 'error' | 'usage' | 'policy'
  label: string
  detail?: string
}
export type StructuredKodyAction = {
  version: 2
  /** Only true when the inspected Kody contract explicitly promises no writes. */
  readOnly?: boolean
  target:
    | { kind: 'capability'; id: string }
    | {
        kind: 'package'
        packageId: string
        sourceId: string
        publishedCommit: string
        importSpecifier: string
        exportName: string
      }
    | {
        kind: 'mcp'
        serverId: string
        serverName: string
        kodyName: string
        toolName: string
      }
  title: string
  input: Record<string, unknown>
}
export interface Approval {
  kodyMemoryCreate?: {
    token: string
    candidate: import('zod').infer<
      typeof import('./kody-memory').kodyMemoryCreateSchema
    >
    related: import('zod').infer<
      typeof import('./kody-memory').kodyMemoryCreateReviewSchema
    >['related']
  }
  workspace?: {
    origin: import('./execution-sessions').ExecutionRunOrigin
    sessionId: string
    runtimeId: string
    hostGeneration: number
    commandId: string
    operation: Extract<
      import('./execution-sessions').ExecutionOperation,
      { type: 'write_file' | 'run' }
    >
  }
  schedule?: {
    command: Extract<
      import('./schedules').ScheduleCommand,
      { type: 'create' | 'update' }
    >
    reason: 'timezone-unset' | 'timezone-change'
    previousTimezone?: string
    nextRun: { iso: string; local: string; timezone: string }
  }
  assistantMcpCall?: import('./mcp-contracts').AssistantMcpCall
  assistantTaskId?: string
  assistantExecutionRevision?: number
  executionOutcome?: 'succeeded' | 'failed' | 'unknown' | 'rejected'
  kodyRunId?: string

  messageId?: string
  mcpTaskCall?: {
    taskId: string
    entry: import('./mcp-contracts').CatalogEntry
    arguments: Record<string, unknown>
    transport: { name: string; arguments: Record<string, unknown> }
  }
  resumeRequest?: string
  turnId?: string
  action?: StructuredKodyAction
  /** Exact discovery reference used to prepare a structured Kody action. */
  kodyEntity?: string
  id: string
  title: string
  code: string
  status: 'pending' | 'running' | 'done' | 'rejected' | 'error'
  result?: string
}
export interface User {
  id: string
  username: string
  email: string
}
export const botSchema = z.object({
  name: z.string().trim().min(1).max(60),
  purpose: z.string().max(2000).default(''),
  parentId: z.string().nullable().default(null),
})
export const recipeSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(1200),
  code: z.string().trim().min(1).max(20000),
})
