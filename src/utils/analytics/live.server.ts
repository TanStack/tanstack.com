import { z } from 'zod'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'
import { isIP } from 'node:net'
import { db } from '~/db/client'
import { liveSessions, liveTabs } from '~/db/schema'
import { requireAdmin } from '~/utils/roles.server'
import {
  scheduleHostRuntimeTask,
  type HostRateLimiter,
} from '~/server/runtime/host.server'
import { getLiveConfig, lookupScarfCompany } from './scarf-lookup.server'
import {
  isLivePage,
  liveCompanySchema,
  livePublicPagePattern,
  liveForbiddenPagePattern,
  liveEventSchema,
  LIVE_RETENTION_MS,
  LIVE_TIMEOUT_MS,
  type LiveEvent,
} from './live'

const responseHeaders = { 'Cache-Control': 'no-store' }

export async function receiveLiveEvent(request: Request) {
  const respond = (status: number) =>
    new Response(null, { status, headers: responseHeaders })
  if (request.method !== 'POST') return respond(405)
  const url = new URL(request.url)
  if (
    url.hostname !== 'tanstack.com' ||
    request.headers.get('origin') !== url.origin
  )
    return respond(403)
  if (
    request.headers.get('dnt') === '1' ||
    request.headers.get('sec-gpc') === '1'
  )
    return respond(204)
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip || !isIP(ip)) return respond(204)
  const config = await getLiveConfig()
  if (!config.enabled) return respond(204)
  // Edge counters bound abuse without writing visitor IPs to the database.
  if (!config.requestLimiter || (config.key && !config.lookupLimiter))
    return respond(503)
  try {
    if (!(await config.requestLimiter.limit({ key: ip })).success)
      return new Response(null, {
        status: 429,
        headers: { ...responseHeaders, 'Retry-After': '60' },
      })
  } catch {
    return respond(503)
  }
  const reader = request.body?.getReader()
  if (!reader) return respond(400)
  const decoder = new TextDecoder()
  let raw = ''
  let size = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > 1024) {
      await reader.cancel()
      return respond(413)
    }
    raw += decoder.decode(chunk.value, { stream: true })
  }
  let value: unknown
  try {
    raw += decoder.decode()
    value = JSON.parse(raw)
  } catch {
    return respond(400)
  }
  const parsed = liveEventSchema.safeParse(value)
  if (!parsed.success) return respond(400)
  try {
    await recordLiveEvent(parsed.data, ip, config.key, config.lookupLimiter)
    return respond(204)
  } catch {
    // Never log a request, body, IP, or third-party exception here.
    console.warn('Live presence update failed')
    return respond(503)
  }
}

export async function recordLiveEvent(
  event: LiveEvent,
  ip: string,
  key: string | undefined,
  lookupLimiter: HostRateLimiter | undefined,
) {
  const now = new Date()
  if (event.kind === 'leave') {
    await db
      .update(liveTabs)
      .set({ leftAt: now, sequence: event.sequence })
      .where(
        and(
          eq(liveTabs.id, event.tabId),
          eq(liveTabs.sessionId, event.sessionId),
          lt(liveTabs.sequence, event.sequence),
        ),
      )
    return
  }
  const [created] = await db
    .insert(liveSessions)
    .values({
      id: event.sessionId,
      lookupStatus: key ? 'pending' : 'unconfigured',
    })
    .onConflictDoNothing()
    .returning({ id: liveSessions.id })
  const activity = event.action
    ? [{ at: now.toISOString(), page: event.page, action: event.action }]
    : []
  await db
    .insert(liveTabs)
    .values({
      id: event.tabId,
      sessionId: event.sessionId,
      page: event.page,
      visible: event.visible,
      sequence: event.sequence,
      lastSeen: now,
      activity,
    })
    .onConflictDoUpdate({
      target: liveTabs.id,
      set: {
        page: event.page,
        visible: event.visible,
        sequence: event.sequence,
        lastSeen: now,
        leftAt: null,
        // Bounded recent history, including when several updates arrive together.
        activity: sql`(SELECT coalesce(jsonb_agg(entry ORDER BY position), '[]'::jsonb) FROM (SELECT entry, position FROM jsonb_array_elements(${liveTabs.activity} || ${JSON.stringify(activity)}::jsonb) WITH ORDINALITY AS history(entry, position) ORDER BY position DESC LIMIT 40) recent)`,
      },
      setWhere: and(
        eq(liveTabs.sessionId, event.sessionId),
        lt(liveTabs.sequence, event.sequence),
      ),
    })
  if (created && key) {
    const enrich = async () => {
      try {
        if (
          !lookupLimiter ||
          !(await lookupLimiter.limit({ key: ip })).success
        ) {
          await db
            .update(liveSessions)
            .set({ lookupStatus: 'rate_limited' })
            .where(eq(liveSessions.id, event.sessionId))
          return
        }
        const company = await lookupScarfCompany(ip, key)
        await db
          .update(liveSessions)
          .set({ company, lookupStatus: company ? 'matched' : 'unknown' })
          .where(eq(liveSessions.id, event.sessionId))
      } catch {
        await db
          .update(liveSessions)
          .set({ lookupStatus: 'failed' })
          .where(eq(liveSessions.id, event.sessionId))
      }
    }
    if (!scheduleHostRuntimeTask(enrich)) await enrich()
  }
}

export async function listLiveVisitors(domain?: string) {
  await requireAdmin()
  const config = await getLiveConfig()
  const now = Date.now()
  if (!config.enabled)
    return {
      enabled: false,
      lookupConfigured: Boolean(config.key),
      now: new Date(now).toISOString(),
      truncated: false,
      tabs: [],
    }
  const rows = await db
    .select({
      sessionId: liveSessions.id,
      arrivedAt: liveSessions.createdAt,
      company: liveSessions.company,
      lookupStatus: liveSessions.lookupStatus,
      tabId: liveTabs.id,
      page: liveTabs.page,
      visible: liveTabs.visible,
      lastSeen: liveTabs.lastSeen,
      leftAt: liveTabs.leftAt,
      activity: liveTabs.activity,
    })
    .from(liveTabs)
    .innerJoin(liveSessions, eq(liveTabs.sessionId, liveSessions.id))
    .where(
      and(
        gt(liveTabs.lastSeen, new Date(now - 5 * 60_000)),
        gt(liveSessions.createdAt, new Date(now - LIVE_RETENTION_MS)),
        domain === undefined
          ? undefined
          : sql`coalesce(lower(${liveSessions.company}->>'domain'), '') = ${domain}`,
        sql`length(${liveTabs.page}) <= 400`,
        sql`${liveTabs.page} ~ ${livePublicPagePattern.source}`,
        sql`${liveTabs.page} !~ ${liveForbiddenPagePattern.source}`,
      ),
    )
    .orderBy(desc(liveTabs.lastSeen))
    .limit(501)
  return {
    enabled: config.enabled,
    lookupConfigured: Boolean(config.key),
    now: new Date(now).toISOString(),
    truncated: rows.length > 500,
    tabs: rows.slice(0, 500).map((row) => ({
      ...row,
      activity: row.activity.filter((event) => isLivePage(event.page)),
      active:
        row.leftAt === null && now - row.lastSeen.getTime() < LIVE_TIMEOUT_MS,
      lookupStatus:
        row.lookupStatus === 'pending' && now - row.arrivedAt.getTime() > 15_000
          ? 'failed'
          : row.lookupStatus,
    })),
  }
}

export async function pruneLiveVisitors(now = Date.now()) {
  // Delete whole sessions at a fixed age, even if a tab remains open.
  await db
    .delete(liveSessions)
    .where(lt(liveSessions.createdAt, new Date(now - LIVE_RETENTION_MS)))
}

export const liveCompanyOverviewRowSchema = z.object({
  id: z.string(),
  company: liveCompanySchema.nullable(),
  activeSessions: z.coerce.number().int().nonnegative(),
  activeTabs: z.coerce.number().int().nonnegative(),
  visibleTabs: z.coerce.number().int().nonnegative(),
  recentSessions: z.coerce.number().int().nonnegative(),
  pages: z.array(z.string()),
  actions: z.coerce.number().int().nonnegative(),
  recentViews: z.coerce.number().int().nonnegative(),
  lastSeen: z.coerce.date(),
})

export function liveCompanyOverviewSql(now: number) {
  const activeSince = new Date(now - LIVE_TIMEOUT_MS).toISOString()
  const recentSince = new Date(now - 5 * 60_000).toISOString()
  const retainedSince = new Date(now - LIVE_RETENTION_MS).toISOString()
  return sql`
    WITH eligible AS (
      SELECT s.id AS session_id, s.company, t.page, t.visible, t.last_seen, t.activity,
        (t.left_at IS NULL AND t.last_seen > ${activeSince}::timestamptz) AS active
      FROM live_tabs t JOIN live_sessions s ON s.id = t.session_id
      WHERE t.last_seen > ${recentSince}::timestamptz AND s.created_at > ${retainedSince}::timestamptz
        AND length(t.page) <= 400 AND t.page ~ ${livePublicPagePattern.source}
        AND t.page !~ ${liveForbiddenPagePattern.source}
    )
    SELECT coalesce(lower(e.company->>'domain'), '') AS id,
      max(e.company::text)::jsonb AS company,
      count(DISTINCT e.session_id) FILTER (WHERE e.active) AS "activeSessions",
      count(*) FILTER (WHERE e.active) AS "activeTabs",
      count(*) FILTER (WHERE e.active AND e.visible) AS "visibleTabs",
      count(DISTINCT e.session_id) AS "recentSessions",
      coalesce(jsonb_agg(DISTINCT e.page ORDER BY e.page) FILTER (WHERE e.active), '[]'::jsonb) AS pages,
      coalesce(sum(a.actions), 0) AS actions, coalesce(sum(a.views), 0) AS "recentViews",
      max(e.last_seen) AS "lastSeen"
    FROM eligible e
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE event->>'action' <> 'page_view') AS actions,
        count(*) FILTER (WHERE event->>'action' = 'page_view') AS views
      FROM jsonb_array_elements(e.activity) event
      WHERE event->>'at' >= ${recentSince}
        AND length(event->>'page') <= 400 AND event->>'page' ~ ${livePublicPagePattern.source}
        AND event->>'page' !~ ${liveForbiddenPagePattern.source}
    ) a
    GROUP BY coalesce(lower(e.company->>'domain'), '')
    ORDER BY id
  `
}

export async function listLiveCompanyOverview() {
  await requireAdmin()
  const config = await getLiveConfig()
  const now = Date.now()
  const companies = config.enabled
    ? z
        .array(liveCompanyOverviewRowSchema)
        .parse(await db.execute(liveCompanyOverviewSql(now)))
    : []
  return {
    enabled: config.enabled,
    lookupConfigured: Boolean(config.key),
    now: new Date(now).toISOString(),
    companies,
  }
}
