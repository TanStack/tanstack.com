import { maxPluginSkills } from '../core/plugins'
import { pluginVersionPins, type PluginVersionPin } from './plugin-contract'
import { hash } from './crypto'
import { skillDocumentSchema } from '../core/skills'
import type { PluginSkill } from './plugin-contract'
import { sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { z } from 'zod'
import { parsePluginPackage, type ParsedPluginPackage } from '../core/plugins'
import {
  PluginError,
  type PluginScope,
  type PluginBinding,
} from './plugin-contract'
const uuid = z.uuid()
const versionSchema = z.number().int().positive().safe()
/** Source package read protocol, adapted to Neon private account storage. */
export class PluginPackages {
  constructor(protected scope: PluginScope) {}
  protected async member() {
    const [row] = await db.execute(
      sql`SELECT 1 FROM chat_memberships WHERE workspace_id=${this.scope.workspaceId} AND user_id=${this.scope.userId}`,
    )
    if (!row) throw new PluginError('Workspace access is unavailable.', 403)
  }
  async preview(files: unknown) {
    await this.member()
    const parsed = await parsePluginPackage(files)
    await this.member()
    return parsed
  }
  async inspect(id: string, version?: number) {
    uuid.parse(id)
    await this.member()
    const [head] = await db.execute<{
      id: string
      current_version: number
      revision: number
      enabled: boolean
      removed: boolean
      created_at: number
      updated_at: number
    }>(
      sql`SELECT id,current_version::double precision AS current_version,revision::double precision AS revision,enabled,removed,created_at::double precision AS created_at,updated_at::double precision AS updated_at FROM chat_plugin_installations WHERE id=${id} AND workspace_id=${this.scope.workspaceId} AND user_id=${this.scope.userId}`,
    )
    if (!head) throw new PluginError('Plugin not found.', 404)
    const requested =
      version === undefined
        ? head.current_version
        : versionSchema.parse(version)
    const [v] = await db.execute<{
      preview: ParsedPluginPackage
      digest: string
    }>(
      sql`SELECT preview,digest FROM chat_plugin_versions WHERE installation_id=${id} AND version=${requested}`,
    )
    if (!v) throw new PluginError('Plugin version not found.', 404)
    const files = await db.execute<{ path: string; text: string }>(
      sql`SELECT path,content AS text FROM chat_plugin_files WHERE installation_id=${id} AND version=${requested} ORDER BY path`,
    )
    const bindings = await db.execute<PluginBinding>(
      sql`SELECT version::double precision AS version,requirement_key AS "requirementKey",server_id AS "serverId",endpoint FROM chat_plugin_bindings WHERE installation_id=${id} AND version=${requested} ORDER BY requirement_key`,
    )
    await this.member()
    return {
      id: head.id,
      name: v.preview.manifest.name,
      description: v.preview.manifest.description ?? '',
      packageVersion: v.preview.manifest.version,
      currentVersion: head.current_version,
      revision: head.revision,
      enabled: head.enabled,
      removed: head.removed,
      createdAt: head.created_at,
      updatedAt: head.updated_at,
      digest: v.digest,
      compatibility: v.preview.compatibility,
      version: requested,
      package: { ...v.preview, files },
      bindings,
    }
  }
  async resolveMetadata(id: string, version: number) {
    uuid.parse(id)
    versionSchema.parse(version)
    await this.member()
    const [row] = await db.execute<{
      id: string
      version: number
      digest: string
      name: string
      description: string | null
      packageVersion: string | null
    }>(
      sql`SELECT p.id,v.version::double precision AS version,v.digest,v.preview->'manifest'->>'name' AS name,v.preview->'manifest'->>'description' AS description,v.preview->'manifest'->>'version' AS "packageVersion" FROM chat_plugin_installations p JOIN chat_memberships m ON m.workspace_id=p.workspace_id AND m.user_id=p.user_id JOIN chat_plugin_versions v ON v.installation_id=p.id AND v.version=${version} WHERE p.id=${id} AND p.workspace_id=${this.scope.workspaceId} AND p.user_id=${this.scope.userId} AND p.enabled=true AND p.removed=false AND v.preview->'compatibility'->>'status'='supported'`,
    )
    if (!row)
      throw new PluginError(
        'This plugin version is unavailable, disabled or removed.',
        409,
      )
    return row
  }
  async authorizeVersion(id: string, version: number) {
    const metadata = await this.resolveMetadata(id, version)
    return {
      id: metadata.id,
      version: metadata.version,
      digest: metadata.digest,
    }
  }
  async resolve(id: string, version: number) {
    const result = await this.inspect(id, version)
    await this.authorizeVersion(id, version)
    if (result.package.compatibility.status !== 'supported')
      throw new PluginError(
        'This plugin version contains unsupported components.',
        409,
      )
    return result
  }
  async readFile(id: string, version: number, path: string) {
    const p = await this.resolve(id, version)
    const file = p.package.files.find((f) => f.path === path)
    if (!file) throw new PluginError('Plugin file not found.', 404)
    await this.authorizeVersion(id, version)
    return {
      path: file.path,
      text: file.text,
      version,
      digest: p.package.digest,
    }
  }
  async inspectSkill(skillId: string, version?: number): Promise<PluginSkill> {
    uuid.parse(skillId)
    await this.member()
    const [identity] = await db.execute<{
      installation_id: string
      path: string
    }>(
      sql`SELECT s.installation_id,s.path FROM chat_plugin_skill_identities s JOIN chat_plugin_installations p ON p.id=s.installation_id WHERE s.id=${skillId} AND p.workspace_id=${this.scope.workspaceId} AND p.user_id=${this.scope.userId}`,
    )
    if (!identity) throw new PluginError('Skill not found.', 404)
    const head = await this.inspect(identity.installation_id)
    if (!head) throw new PluginError('Skill not found.', 404)
    const v =
      version === undefined ? head.currentVersion : versionSchema.parse(version)
    const [row] = await db.execute<{
      document: string
      preview: string
      digest: string
    }>(
      sql`SELECT s.document::text AS document,p.preview::text AS preview,p.digest FROM chat_plugin_skill_versions s JOIN chat_plugin_versions p ON p.installation_id=${identity.installation_id} AND p.version=s.version WHERE s.skill_id=${skillId} AND s.version=${v}`,
    )
    if (!row) throw new PluginError('Skill version not found.', 404)
    await this.member()
    const document = skillDocumentSchema.parse(JSON.parse(row.document)),
      parsed = JSON.parse(row.preview) as ParsedPluginPackage
    return {
      id: skillId,
      name: document.name,
      description: document.description,
      version: v,
      revision: head.revision,
      enabled: !!head.enabled,
      archived: !!head.removed,
      createdAt: head.createdAt,
      updatedAt: head.updatedAt,
      document,
      origin: {
        installationId: head.id,
        installationName: parsed.manifest.name,
        packageVersion: parsed.manifest.version,
        installedVersion: v,
        path: identity.path,
        digest: row.digest,
      },
    }
  }
  async resolveSkill(input: { skillId: string; version: number }) {
    versionSchema.parse(input.version)
    const skill = await this.inspectSkill(input.skillId, input.version)
    await this.resolve(skill.origin.installationId, input.version)
    return skill
  }
  async listSkills(
    input: unknown = {},
    versions: readonly PluginVersionPin[] = [],
  ) {
    const { pins, key: pinJson } = pluginVersionPins(versions)
    const pinKey = pinJson ? await hash(pinJson) : undefined
    const o = z
      .object({
        query: z.string().trim().max(200).default(''),
        cursor: z.string().max(4000).optional(),
        limit: z.number().int().min(1).max(50).default(50),
      })
      .strict()
      .parse(input)
    await this.member()
    for (const pin of pins)
      await this.authorizeVersion(pin.installationId, pin.version)
    let after = ''
    if (o.cursor) {
      try {
        const c = z
          .object({
            id: uuid,
            query: z.string(),
            pins: z.string().max(1000).optional(),
          })
          .strict()
          .parse(JSON.parse(decodeURIComponent(atob(o.cursor))))
        if (c.query !== o.query || c.pins !== pinKey) throw Error()
        after = c.id
      } catch {
        throw new PluginError('The skill list cursor is invalid.')
      }
    }
    const rows = await db.execute<{
      id: string
      path: string
      installation_id: string
      current_version: number
      revision: number
      created_at: number
      updated_at: number
      name: string
      description: string
      installation_name: string
      package_version: string | null
      digest: string
    }>(sql`
      SELECT s.id,s.path,p.id AS installation_id,v.version::double precision AS current_version,
      p.revision::double precision AS revision,p.created_at::double precision AS created_at,
      p.updated_at::double precision AS updated_at,v.document->>'name' AS name,
      v.document->>'description' AS description,pv.preview->'manifest'->>'name' AS installation_name,
      pv.preview->'manifest'->>'version' AS package_version,pv.digest
      FROM chat_plugin_skill_identities s JOIN chat_plugin_installations p ON p.id=s.installation_id
      LEFT JOIN jsonb_array_elements(${JSON.stringify(pins)}::jsonb) pin ON pin->>'installationId'=p.id::text
      JOIN chat_plugin_skill_versions v ON v.skill_id=s.id AND v.version=COALESCE((pin->>'version')::bigint,p.current_version)
      JOIN chat_plugin_versions pv ON pv.installation_id=p.id AND pv.version=v.version
      WHERE p.workspace_id=${this.scope.workspaceId} AND p.user_id=${this.scope.userId}
      AND p.enabled=true AND p.removed=false AND s.id::text>${after}
      AND (strpos(lower(v.document->>'name'),lower(${o.query}))>0 OR strpos(lower(v.document->>'description'),lower(${o.query}))>0)
      ORDER BY s.id LIMIT ${o.limit + 1}`)
    const items = rows.slice(0, o.limit).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      version: r.current_version,
      revision: r.revision,
      enabled: true,
      archived: false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      origin: {
        installationId: r.installation_id,
        installationName: r.installation_name,
        packageVersion: r.package_version ?? undefined,
        installedVersion: r.current_version,
        path: r.path,
        digest: r.digest,
      },
    }))
    await this.member()
    for (const pin of pins)
      await this.authorizeVersion(pin.installationId, pin.version)
    const last = items.at(-1)
    return {
      items,
      ...(rows.length > o.limit && last
        ? {
            nextCursor: btoa(
              encodeURIComponent(
                JSON.stringify({ id: last.id, query: o.query, pins: pinKey }),
              ),
            ),
          }
        : {}),
    }
  }
  async skillMetadata(installationId: string, version: number) {
    await this.authorizeVersion(installationId, version)
    const rows = await db.execute<{
      id: string
      version: number
      path: string
      name: string
      description: string
    }>(
      sql`SELECT i.id,v.version::double precision AS version,i.path,v.document->>'name' AS name,v.document->>'description' AS description FROM chat_plugin_skill_identities i JOIN chat_plugin_skill_versions v ON v.skill_id=i.id AND v.version=${version} WHERE i.installation_id=${installationId} ORDER BY i.path LIMIT ${maxPluginSkills + 1}`,
    )
    await this.authorizeVersion(installationId, version)
    if (rows.length > maxPluginSkills)
      throw new PluginError('This plugin version has too many skills.', 409)
    return rows.map((row) => ({ ...row, id: `plugin:${row.id}` }))
  }
}
