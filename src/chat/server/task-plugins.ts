import type { CredentialEnv } from './credentials'
import type { AssistantTask } from '../core/assistant-task'
import { maxSelectedPlugins } from '../core/message-references'
import { Plugins, PluginError, type PluginScope } from './plugins'

export type TaskPlugin = { installationId: string; version: number }
export function pinTaskPlugin(task: AssistantTask, plugin: TaskPlugin) {
  pinTaskPlugins(task, [plugin])
}
/** Validate the complete addition before mutating durable task state. */
export function pinTaskPlugins(
  task: AssistantTask,
  plugins: readonly TaskPlugin[],
) {
  const current = task.loadedPlugins ?? []
  const next = [...current]
  for (const plugin of plugins) {
    const existing = next.find(
      (item) => item.installationId === plugin.installationId,
    )
    if (existing) {
      if (existing.version !== plugin.version)
        throw new PluginError(
          'Another version of this plugin is already active in this task. Start a new task to use the updated version.',
          409,
        )
      continue
    }
    if (next.length >= maxSelectedPlugins)
      throw new PluginError(
        `Use up to ${maxSelectedPlugins} plugins in one task.`,
        409,
      )
    next.push({ ...plugin })
  }
  if (next.length !== current.length) task.loadedPlugins = next
}
export async function authorizeTaskPlugins(
  env: CredentialEnv,
  scope: PluginScope,
  task: AssistantTask,
) {
  const plugins = new Plugins(env, scope)
  for (const item of task.loadedPlugins ?? [])
    await plugins.authorizeVersion(item.installationId, item.version)
}
