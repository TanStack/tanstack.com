import { z } from 'zod'

const sourceState = z.enum(['ready', 'unavailable', 'not_requested'])

export const kodyAccountSectionSchema = z.enum([
  'identity',
  'packages',
  'jobs',
  'workflows',
  'runs',
  'integrations',
  'servers',
  'secrets',
  'waiting',
])
export type KodyAccountSection = z.infer<typeof kodyAccountSectionSchema>

export const kodyAccountSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'unavailable']),
  identity: z.object({
    status: sourceState,
    userId: z.string().optional(),
    displayName: z.string().optional(),
    email: z.string().optional(),
  }),
  packages: z.object({
    status: sourceState,
    executionReadiness: z.literal('not_checked'),
    limited: z.boolean(),
    items: z.array(
      z.object({
        id: z.string(),
        sourceId: z.string().optional(),
        hasApp: z.boolean().optional(),
        lockedAt: z.string().optional(),
        upstreamAhead: z.boolean().optional(),
        upstreamRevision: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        visibility: z.string().optional(),
        updatedAt: z.string().optional(),
        revision: z.string().optional(),
        sourceListing: z.string().optional(),
        iconUrl: z.string().url().optional(),
      }),
    ),
  }),
  jobs: z.object({
    status: sourceState,
    limited: z.boolean(),
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        sourceId: z.string(),
        publishedCommit: z.string().optional(),
        schedule: z.string(),
        enabled: z.boolean(),
        killSwitchEnabled: z.boolean(),
        expired: z.boolean(),
        updatedAt: z.string(),
        nextRunAt: z.string().optional(),
        lastRunStatus: z.string().optional(),
      }),
    ),
  }),
  workflows: z.object({
    status: sourceState,
    limited: z.boolean(),
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string().optional(),
        sourceId: z.string().optional(),
        updatedAt: z.string().optional(),
      }),
    ),
  }),
  runs: z.object({
    status: sourceState,
    items: z.array(
      z.object({
        id: z.string(),
        surface: z.string(),
        status: z.string(),
        name: z.string().optional(),
        packageId: z.string().optional(),
        sourceId: z.string().optional(),
        publishedCommit: z.string().optional(),
        startedAt: z.string(),
        durationMs: z.number().optional(),
      }),
    ),
    more: z.boolean(),
  }),
  integrations: z.object({
    status: sourceState,
    items: z.array(
      z.object({
        name: z.string(),
        usageMode: z.string().optional(),
        authFailure: z
          .object({
            title: z.string(),
            why: z.string().optional(),
            reconnectHref: z.string().optional(),
          })
          .optional(),
      }),
    ),
  }),
  servers: z.object({
    status: sourceState,
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        connected: z.boolean(),
        state: z.string(),
        toolCount: z.number(),
        updatedAt: z.string(),
        error: z.string().optional(),
      }),
    ),
  }),
  secrets: z.object({
    status: sourceState,
    items: z.array(
      z.object({
        name: z.string(),
        scope: z.string().optional(),
        expiresAt: z.string().optional(),
      }),
    ),
  }),
  waiting: z.object({
    status: sourceState,
    items: z.array(
      z.object({
        kind: z.string(),
        title: z.string(),
        why: z.string().optional(),
        href: z.string().optional(),
        severity: z.string().optional(),
      }),
    ),
  }),
  checkedAt: z.string(),
})

export type KodyAccount = z.infer<typeof kodyAccountSchema>
