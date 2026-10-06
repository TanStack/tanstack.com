import { z } from 'zod'
const uuid = z.uuid()
import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  chatPluginInstallations,
  chatPluginVersions,
  chatPluginFiles,
  chatPluginSkillIdentities,
  chatPluginSkillVersions,
  chatPluginBindings,
  chatPluginCommands,
  chatMcpAccounts,
} from '~/db/schema'
import { pluginCommandSchema } from '../core/plugin-lifecycle'
import { parsePluginPackage, type ParsedPluginPackage } from '../core/plugins'
import { PluginPackages } from './plugin-packages'
import { PluginError, type PluginScope } from './plugin-contract'
import { McpAccounts } from './mcp-accounts'
import type { CredentialEnv } from './credentials'
import { hash } from './crypto'
import { validateMcpEndpoint } from './public-endpoint'
type Row = {
  id: string
  workspace_id: string
  user_id: string
  current_version: number
  revision: number
  enabled: number
  removed: number
  created_at: number
  updated_at: number
  preview: string
  digest: string
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ':' + canonical(x))
        .join(',') +
      '}'
    )
  return JSON.stringify(v)
}
function summary(row: Row) {
  const p = JSON.parse(row.preview) as ParsedPluginPackage
  return {
    id: row.id,
    name: p.manifest.name,
    description: p.manifest.description ?? '',
    packageVersion: p.manifest.version,
    currentVersion: row.current_version,
    revision: row.revision,
    enabled: !!row.enabled,
    removed: !!row.removed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    digest: row.digest,
    compatibility: p.compatibility,
  }
}
export type PluginSummary = ReturnType<typeof summary>
const listSchema = z
  .object({
    query: z.string().trim().max(200).default(''),
    removed: z.boolean().default(false),
    enabled: z.boolean().optional(),
    cursor: z.string().max(4000).optional(),
    limit: z.number().int().min(1).max(50).default(50),
  })
  .strict()
export class Plugins extends PluginPackages {
  constructor(
    private env: CredentialEnv,
    scope: PluginScope,
  ) {
    super(scope)
  }
  async command(input: unknown): Promise<PluginSummary> {
    const c = pluginCommandSchema.parse(input)
    await this.member()
    const requestHash = await hash(canonical(c))
    const [existingReceipt] = await db
      .select()
      .from(chatPluginCommands)
      .where(
        and(
          eq(chatPluginCommands.workspaceId, this.scope.workspaceId),
          eq(chatPluginCommands.userId, this.scope.userId),
          eq(chatPluginCommands.commandId, c.commandId),
        ),
      )
    if (existingReceipt) {
      if (existingReceipt.requestHash !== requestHash)
        throw new PluginError(
          'This command ID was already used for another change.',
          409,
        )
      await this.member()
      return existingReceipt.receipt as PluginSummary
    }
    const connected =
      c.type === 'bind' && c.serverId
        ? (
            await new McpAccounts(this.env, this.scope).configuredServers()
          ).find((server) => server.id === c.serverId)
        : undefined
    return db.transaction(async (tx) => {
      const [membership] = await tx.execute(
        sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.scope.workspaceId} AND user_id=${this.scope.userId} FOR UPDATE`,
      )
      if (!membership)
        throw new PluginError('Workspace access is unavailable.', 403)
      const [previous] = await tx
        .select()
        .from(chatPluginCommands)
        .where(
          and(
            eq(chatPluginCommands.workspaceId, this.scope.workspaceId),
            eq(chatPluginCommands.userId, this.scope.userId),
            eq(chatPluginCommands.commandId, c.commandId),
          ),
        )
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new PluginError(
            'This command ID was already used for another change.',
            409,
          )
        return previous.receipt as PluginSummary
      }
      const [stored] = await tx
        .select()
        .from(chatPluginInstallations)
        .where(eq(chatPluginInstallations.id, c.id))
        .for('update')
      if (
        stored &&
        (stored.workspaceId !== this.scope.workspaceId ||
          stored.userId !== this.scope.userId)
      )
        throw new PluginError('Plugin not found.', 404)
      const [storedVersion] = stored
        ? await tx
            .select()
            .from(chatPluginVersions)
            .where(
              and(
                eq(chatPluginVersions.installationId, c.id),
                eq(chatPluginVersions.version, stored.currentVersion),
              ),
            )
        : []
      const old: Row | undefined =
        stored && storedVersion
          ? {
              id: stored.id,
              workspace_id: stored.workspaceId,
              user_id: stored.userId,
              current_version: stored.currentVersion,
              revision: stored.revision,
              enabled: Number(stored.enabled),
              removed: Number(stored.removed),
              created_at: stored.createdAt,
              updated_at: stored.updatedAt,
              preview: JSON.stringify(storedVersion.preview),
              digest: storedVersion.digest,
            }
          : undefined
      if (c.type === 'install' ? !!old : !old)
        throw new PluginError(
          c.type === 'install' ? 'Plugin already exists.' : 'Plugin not found.',
          c.type === 'install' ? 409 : 404,
        )
      if (c.type !== 'install' && old!.revision !== c.expectedRevision)
        throw new PluginError(
          'This plugin changed. Reload it before editing.',
          409,
        )
      if (old?.removed && !['restore', 'remove'].includes(c.type))
        throw new PluginError('Restore this plugin before changing it.', 409)
      const parsed =
        c.type === 'install' || c.type === 'update'
          ? await parsePluginPackage(c.files)
          : (JSON.parse(old!.preview) as ParsedPluginPackage)
      if (
        (c.type === 'install' || c.type === 'update') &&
        parsed.digest !== c.digest
      )
        throw new PluginError(
          'The package changed after review. Review it again.',
          409,
        )
      const now = Date.now(),
        version =
          c.type === 'install'
            ? 1
            : old!.current_version + Number(c.type === 'update')
      const enabled =
        c.type === 'install'
          ? Number(c.enabled)
          : c.type === 'enabled'
            ? Number(c.enabled)
            : ['remove', 'restore'].includes(c.type)
              ? 0
              : old!.enabled
      if (enabled && parsed.compatibility.status !== 'supported')
        throw new PluginError(
          'This package contains unsupported components and must remain disabled.',
          409,
        )
      let binding: { serverId: string; endpoint: string } | undefined
      if (c.type === 'bind') {
        if (c.version !== old!.current_version)
          throw new PluginError(
            'Only the current plugin version can change connection bindings.',
            409,
          )
        const requirement = parsed.mcpServers.find(
          (r) => r.key === c.requirementKey,
        )
        if (!requirement)
          throw new PluginError('Connection requirement not found.', 404)
        if (c.serverId) {
          if (!requirement.supported || !requirement.url)
            throw new PluginError(
              'This connection requirement is unsupported.',
              409,
            )
          const server = connected
          if (server) {
            const [current] = await tx
              .select()
              .from(chatMcpAccounts)
              .where(
                and(
                  eq(chatMcpAccounts.id, server.id),
                  eq(chatMcpAccounts.userId, this.scope.userId),
                ),
              )
              .for('share')
            if (
              !current ||
              !current.enabled ||
              current.removed ||
              current.status === 'needs_auth' ||
              current.grantId !== server.credentialId ||
              current.url !== server.url
            )
              throw new PluginError(
                'Choose an enabled saved MCP connection.',
                409,
              )
          }
          if (!server || !server.enabled)
            throw new PluginError(
              'Choose an enabled saved MCP connection.',
              409,
            )
          const endpoint = validateMcpEndpoint(requirement.url)
          if (validateMcpEndpoint(server.url) !== endpoint)
            throw new PluginError(
              'The saved connection endpoint does not match this requirement.',
              409,
            )
          binding = { serverId: server.id, endpoint }
        }
      }
      const next: Row = {
        id: c.id,
        workspace_id: this.scope.workspaceId,
        user_id: this.scope.userId,
        current_version: version,
        revision: (old?.revision ?? 0) + 1,
        enabled,
        removed:
          c.type === 'remove'
            ? 1
            : c.type === 'restore'
              ? 0
              : (old?.removed ?? 0),
        created_at: old?.created_at ?? now,
        updated_at: now,
        preview: JSON.stringify({ ...parsed, files: [] }),
        digest: parsed.digest,
      }
      const receipt = summary(next)
      if (!old) {
        const [count] = await tx.execute<{ count: number }>(
          sql`SELECT count(*)::integer AS count FROM chat_plugin_installations WHERE workspace_id=${this.scope.workspaceId} AND user_id=${this.scope.userId}`,
        )
        if (count.count >= 50)
          throw new PluginError(
            'The installation changed or the 50 installation limit was reached.',
            409,
          )
      }
      const values = {
        id: next.id,
        workspaceId: next.workspace_id,
        userId: next.user_id,
        currentVersion: next.current_version,
        revision: next.revision,
        enabled: !!next.enabled,
        removed: !!next.removed,
        createdAt: next.created_at,
        updatedAt: next.updated_at,
      }
      if (old)
        await tx
          .update(chatPluginInstallations)
          .set(values)
          .where(eq(chatPluginInstallations.id, c.id))
      else {
        const inserted = await tx
          .insert(chatPluginInstallations)
          .values(values)
          .onConflictDoNothing()
          .returning({ id: chatPluginInstallations.id })
        if (!inserted.length)
          throw new PluginError('Plugin already exists.', 409)
      }
      if (c.type === 'install' || c.type === 'update') {
        await tx.insert(chatPluginVersions).values({
          installationId: c.id,
          version,
          digest: parsed.digest,
          preview: { ...parsed, files: [] },
          createdAt: now,
        })
        if (parsed.files.length)
          await tx.insert(chatPluginFiles).values(
            parsed.files.map((file) => ({
              installationId: c.id,
              version,
              path: file.path,
              content: file.text,
            })),
          )
        const identities = await tx
          .select()
          .from(chatPluginSkillIdentities)
          .where(eq(chatPluginSkillIdentities.installationId, c.id))
        for (const skill of parsed.skills) {
          const id =
            identities.find((item) => item.path === skill.path)?.id ??
            crypto.randomUUID()
          if (!identities.some((item) => item.id === id))
            await tx
              .insert(chatPluginSkillIdentities)
              .values({ id, installationId: c.id, path: skill.path })
          await tx
            .insert(chatPluginSkillVersions)
            .values({ skillId: id, version, document: skill.document })
        }
      }
      if (c.type === 'bind') {
        await tx
          .delete(chatPluginBindings)
          .where(
            and(
              eq(chatPluginBindings.installationId, c.id),
              eq(chatPluginBindings.version, c.version),
              eq(chatPluginBindings.requirementKey, c.requirementKey),
            ),
          )
        if (binding)
          await tx.insert(chatPluginBindings).values({
            installationId: c.id,
            version: c.version,
            requirementKey: c.requirementKey,
            serverId: binding.serverId,
            endpoint: binding.endpoint,
          })
      }
      await tx.insert(chatPluginCommands).values({
        workspaceId: this.scope.workspaceId,
        userId: this.scope.userId,
        commandId: c.commandId,
        requestHash,
        receipt,
        createdAt: now,
      })
      return receipt
    })
  }
  async list(input: unknown = {}) {
    const o = listSchema.parse(input)
    await this.member()
    let cursor: { time: number; id: string; filter: string } | undefined
    const filter = canonical({
      query: o.query,
      removed: o.removed,
      enabled: o.enabled ?? null,
    })
    if (o.cursor) {
      try {
        cursor = z
          .object({
            time: z.number().int().nonnegative(),
            id: uuid,
            filter: z.string(),
          })
          .strict()
          .parse(JSON.parse(decodeURIComponent(atob(o.cursor))))
      } catch {
        throw new PluginError('The plugin list cursor is invalid.')
      }
      if (cursor.filter !== filter)
        throw new PluginError(
          'Restart this plugin list after changing its filters.',
        )
    }
    const rows = await db.execute<Row>(sql`
      SELECT p.id,p.workspace_id,p.user_id,p.current_version::double precision AS current_version,p.revision::double precision AS revision,
      CASE WHEN p.enabled THEN 1 ELSE 0 END AS enabled,CASE WHEN p.removed THEN 1 ELSE 0 END AS removed,
      p.created_at::double precision AS created_at,p.updated_at::double precision AS updated_at,
      jsonb_build_object('manifest',v.preview->'manifest','compatibility',v.preview->'compatibility')::text AS preview,v.digest
      FROM chat_plugin_installations p JOIN chat_plugin_versions v ON v.installation_id=p.id AND v.version=p.current_version
      WHERE p.workspace_id=${this.scope.workspaceId} AND p.user_id=${this.scope.userId} AND p.removed=${o.removed}
      ${o.enabled === undefined ? sql`` : sql`AND p.enabled=${o.enabled}`}
      AND (strpos(lower(v.preview->'manifest'->>'name'),lower(${o.query}))>0 OR strpos(lower(COALESCE(v.preview->'manifest'->>'description','')),lower(${o.query}))>0)
      ${cursor ? sql`AND (p.updated_at<${cursor.time} OR (p.updated_at=${cursor.time} AND p.id>${cursor.id}::uuid))` : sql``}
      ORDER BY p.updated_at DESC,p.id ASC LIMIT ${o.limit + 1}`)
    await this.member()
    const page = rows.slice(0, o.limit),
      last = page.at(-1)
    return {
      items: page.map(summary),
      ...(rows.length > o.limit && last
        ? {
            nextCursor: btoa(
              encodeURIComponent(
                JSON.stringify({ time: last.updated_at, id: last.id, filter }),
              ),
            ),
          }
        : {}),
    }
  }
}
export { PluginError, type PluginScope } from './plugin-contract'
