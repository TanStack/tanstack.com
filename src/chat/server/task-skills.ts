import type { KodyEnvironment } from './kody'
import type { AssistantTask } from '../core/assistant-task'
import { validateSkillContext, type SkillVersion } from '../core/skills'
import { SkillError, type SkillScope } from './skills'
import { SkillCatalog } from './skill-catalog'

export async function resolveTaskSkills(
  env: KodyEnvironment,
  scope: SkillScope,
  task: AssistantTask,
) {
  const skills = new SkillCatalog(env, scope)
  const loaded: SkillVersion[] = []
  for (const selection of task.loadedSkills ?? [])
    loaded.push(await skills.resolve(selection))
  return loaded
}

/** Activation is task state, never a display label or an instruction from old history. */
export function pinTaskSkill(
  task: AssistantTask,
  skill: SkillVersion,
  explicit: readonly SkillVersion[],
  loaded: SkillVersion[],
) {
  const current = [...explicit, ...loaded].find((item) => item.id === skill.id)
  if (current) {
    if (current.version !== skill.version)
      throw new SkillError(
        'Another version of this skill is already active in this task. Use that version or start a new task.',
        409,
      )
    return
  }
  try {
    validateSkillContext([...explicit, ...loaded, skill])
  } catch (error) {
    throw new SkillError(
      error instanceof Error
        ? error.message
        : 'The skill context is too large.',
      409,
    )
  }
  loaded.push(skill)
  task.loadedSkills = loaded.map((item) => ({
    skillId: item.id,
    version: item.version,
  }))
}
