import { PluginPackages as Plugins } from './plugin-packages'
import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  skillIdentifierSchema,
  skillSummarySchema,
  skillVersionSchema,
  type SkillSummary,
} from '../core/skills'
import { Skills, SkillError, type SkillScope } from './skills'
import { hash } from './crypto'
import { KodySkillCatalog } from './kody-skill-catalog'
import { kodySkillQuery } from './kody-skill-search'
import {
  PluginError,
  pluginVersionPins,
  type PluginVersionPin,
} from './plugin-contract'

const listSchema = z
  .object({
    query: z.string().trim().max(200).default(''),
    cursor: z.string().max(8000).optional(),
    limit: z.number().int().min(1).max(50).default(50),
    source: z.enum(['all', 'external']).default('all'),
  })
  .strict()
const cursorSchema = z
  .object({
    source: z.enum(['private', 'plugin', 'kody']),
    cursor: z.string().max(4000).optional(),
    query: z.string(),
    mode: z.enum(['all', 'external']).optional(),
    pins: z.string().max(1000).optional(),
  })
  .strict()
const selectionSchema = z
  .object({
    skillId: skillIdentifierSchema,
    version: z.number().int().positive().safe(),
  })
  .strict()

/** Namespaces are identities, never a name-based precedence rule. */
export class SkillCatalog {
  private standalone: Skills
  private plugins: Plugins
  private kody: KodySkillCatalog
  constructor(env: KodyEnvironment, scope: SkillScope) {
    this.standalone = new Skills(scope)
    this.plugins = new Plugins(scope)
    this.kody = new KodySkillCatalog(env, scope)
  }
  private async recover<T>(work: () => Promise<T>) {
    try {
      return await work()
    } catch (error) {
      if (error instanceof PluginError)
        throw new SkillError(error.message, error.status)
      throw error
    }
  }
  async list(
    input: unknown = {},
    versions: readonly PluginVersionPin[] = [],
  ): Promise<{ items: SkillSummary[]; nextCursor?: string }> {
    return this.recover(async () => {
      const options = listSchema.parse(input)
      const { source: mode, ...listing } = options
      const { pins, key: pinJson } = pluginVersionPins(versions)
      const pinKey = pinJson ? await hash(pinJson) : undefined
      let cursor: z.infer<typeof cursorSchema> = {
        source: mode === 'external' ? 'plugin' : 'private',
        query: options.query,
        ...(mode === 'external' ? { mode: 'external' as const } : {}),
        ...(pinKey ? { pins: pinKey } : {}),
      }
      if (options.cursor) {
        try {
          cursor = cursorSchema.parse(
            JSON.parse(decodeURIComponent(atob(options.cursor))),
          )
        } catch {
          throw new SkillError('The skill catalog cursor is invalid.')
        }
        if (
          cursor.query !== options.query ||
          cursor.pins !== pinKey ||
          (cursor.mode ?? 'all') !== mode ||
          (mode === 'external' && cursor.source === 'private')
        )
          throw new SkillError(
            'Restart the skill search after changing its query or active plugin versions.',
          )
      }
      // Fill a page across all three identity namespaces. In particular, a
      // short local list must not hide Kody matches from the composer.
      const items: SkillSummary[] = []
      let next: z.infer<typeof cursorSchema> | undefined
      while (items.length < options.limit) {
        const remaining = options.limit - items.length
        if (cursor.source === 'private') {
          const page = await this.standalone.list({
            ...listing,
            limit: remaining,
            cursor: cursor.cursor,
            enabled: true,
            archived: false,
          })
          items.push(
            ...page.items.map((item) => skillSummarySchema.parse(item)),
          )
          if (page.nextCursor) {
            next = { ...cursor, cursor: page.nextCursor }
            break
          }
          cursor = {
            source: 'plugin',
            query: options.query,
            ...(pinKey ? { pins: pinKey } : {}),
          }
          next = cursor
        } else if (cursor.source === 'plugin') {
          const page = await this.plugins.listSkills(
            { ...listing, limit: remaining, cursor: cursor.cursor },
            pins,
          )
          items.push(
            ...page.items.map((item) =>
              skillSummarySchema.parse({ ...item, id: `plugin:${item.id}` }),
            ),
          )
          if (page.nextCursor) {
            next = { ...cursor, cursor: page.nextCursor }
            break
          }
          cursor = {
            source: 'kody',
            query: options.query,
            ...(mode === 'external' ? { mode: 'external' as const } : {}),
            ...(pinKey ? { pins: pinKey } : {}),
          }
          next = cursor
        } else {
          const all = await this.kody.list(kodySkillQuery(options.query))
          const offset = cursor.cursor ? Number(cursor.cursor) : 0
          if (
            !Number.isSafeInteger(offset) ||
            offset < 0 ||
            offset > all.length
          )
            throw new SkillError('The skill catalog cursor is invalid.')
          items.push(...all.slice(offset, offset + remaining))
          next =
            offset + remaining < all.length
              ? { ...cursor, cursor: String(offset + remaining) }
              : undefined
          break
        }
      }
      return {
        items,
        ...(next
          ? { nextCursor: btoa(encodeURIComponent(JSON.stringify(next))) }
          : {}),
      }
    })
  }
  async inspect(id: string, version?: number) {
    return this.recover(async () => {
      skillIdentifierSchema.parse(id)
      if (id.startsWith('kody:')) return this.kody.inspect(id, version)
      if (!id.startsWith('plugin:')) return this.standalone.inspect(id, version)
      const skill = await this.plugins.inspectSkill(id.slice(7), version)
      return skillVersionSchema.parse({ ...skill, id })
    })
  }
  async resolve(input: unknown) {
    return this.recover(async () => {
      const selection = selectionSchema.parse(input)
      if (selection.skillId.startsWith('kody:'))
        return this.kody.inspect(selection.skillId, selection.version)
      if (!selection.skillId.startsWith('plugin:'))
        return this.standalone.resolve(selection)
      const skill = await this.plugins.resolveSkill({
        ...selection,
        skillId: selection.skillId.slice(7),
      })
      return skillVersionSchema.parse({ ...skill, id: selection.skillId })
    })
  }
}
