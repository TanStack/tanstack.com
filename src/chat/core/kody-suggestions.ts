import type { SkillSummary } from './skills'
export interface KodyCapabilitySuggestion {
  entity: string
  operation?: string
  label: string
  detail: string
}
export type KodySkillSuggestion = Pick<
  SkillSummary,
  'id' | 'version' | 'name' | 'description'
>
