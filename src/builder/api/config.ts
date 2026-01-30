import { getFrameworkById } from '@tanstack/create'
import type { FrameworkId } from '../frameworks'

export { type FrameworkId, FRAMEWORKS } from '../frameworks'

export function getFramework(id: FrameworkId = 'react-cra') {
  const framework = getFrameworkById(id)
  if (!framework) {
    throw new Error(`${id} framework not found`)
  }
  return framework
}

export const DEFAULT_MODE = 'file-router'
export const DEFAULT_REQUIRED_ADDONS = ['start']
