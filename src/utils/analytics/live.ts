import { z } from 'zod'

export const LIVE_HEARTBEAT_MS = 20_000
export const LIVE_TIMEOUT_MS = 65_000
export const LIVE_RETENTION_MS = 24 * 60 * 60 * 1000

export const liveActions = {
  page_view: 'Viewed page',
  partner_clicked: 'Clicked partner link',
  partner_inquiry_started: 'Started partner inquiry',
  application_starter_generated: 'Generated starter',
  application_starter_activated: 'Used starter',
  install_command_copied: 'Copied install command',
  external_link_click: 'Clicked external link',
  download_requested: 'Requested download',
}

export const liveActionSchema = z.enum([
  'page_view',
  'partner_clicked',
  'partner_inquiry_started',
  'application_starter_generated',
  'application_starter_activated',
  'install_command_copied',
  'external_link_click',
  'download_requested',
])

// Only public content paths. Never store a query, fragment, or private route.
export const livePublicPagePattern =
  /^\/(?:$|(?:query|router|start|table|db|form|store|virtual|pacer|hotkeys|ai|charts|intent|devtools|config|cli|highlight|markdown|ranger|redact|mcp|workflow)(?:\/|$)|(?:blog|partners|application-starter|libraries|stack|stats)(?:\/|$)|(?:brand-guide|community-projects|ethos|explore|feedback-leaderboard|learn|maintainers|paid-support|privacy|showcase|showcases|support|tenets|terms|workshops)\/?$)/
export const liveForbiddenPagePattern = /[?#\\\s%]|\.\./

export function isLivePage(page: string) {
  return (
    page.length <= 400 &&
    livePublicPagePattern.test(page) &&
    !liveForbiddenPagePattern.test(page)
  )
}

export const liveEventSchema = z.object({
  sessionId: z.uuid(),
  tabId: z.uuid(),
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.string().refine(isLivePage),
  visible: z.boolean(),
  kind: z.enum(['update', 'leave']),
  action: liveActionSchema.optional(),
  chatProof: z.uuid().optional(),
})

export const liveCompanySchema = z.object({
  name: z.string().nullable(),
  domain: z.string(),
  industry: z.string().nullable(),
  company_size: z.string().nullable(),
  linkedin_url: z.string().nullable(),
})

export type LiveCompany = z.infer<typeof liveCompanySchema>
export type LiveEvent = z.infer<typeof liveEventSchema>
export type LiveActivity = {
  at: string
  page: string
  action: z.infer<typeof liveActionSchema>
}
