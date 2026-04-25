import { getFrameworkById } from '@tanstack/create'
import { normalizeFrameworkId, type FrameworkId } from '../frameworks'

export { type FrameworkId, FRAMEWORKS, normalizeFrameworkId } from '../frameworks'

export function getFramework(id: FrameworkId | string = 'react') {
  const framework = getFrameworkById(normalizeFrameworkId(id))
  if (!framework) {
    throw new Error(`${id} framework not found`)
  }
  return framework
}

export const DEFAULT_MODE = 'file-router'
export const DEFAULT_REQUIRED_ADDONS: Array<string> = []
