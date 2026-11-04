import { z } from 'zod'
import { maxSelectedPlugins } from '../core/message-references'
import type { SkillVersion } from '../core/skills'
export interface PluginScope {
  workspaceId: string
  userId: string
}
export class PluginError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'PluginError'
  }
}
const uuid = z.string().uuid(),
  versionSchema = z.number().int().positive().safe()
export type PluginVersionPin = { installationId: string; version: number }
export function pluginVersionPins(versions: readonly PluginVersionPin[] = []) {
  const pins = z
    .array(z.object({ installationId: uuid, version: versionSchema }).strict())
    .max(maxSelectedPlugins)
    .parse(versions)
    .sort((a, b) => a.installationId.localeCompare(b.installationId))
  if (new Set(pins.map((pin) => pin.installationId)).size !== pins.length)
    throw new PluginError('A plugin can have only one active version.')
  return { pins, key: pins.length ? JSON.stringify(pins) : undefined }
}
export { pluginCommandSchema } from '../core/plugin-lifecycle'
export type PluginOrigin = {
  installationId: string
  installationName: string
  packageVersion?: string
  installedVersion: number
  path: string
  digest: string
}
export type PluginSkill = SkillVersion & { origin: PluginOrigin }
export type PluginBinding = {
  version: number
  requirementKey: string
  serverId: string
  endpoint: string
}
