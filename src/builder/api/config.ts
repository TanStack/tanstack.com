import { getFrameworkById } from '@tanstack/cta-engine'
import { register as registerReact } from '@tanstack/cta-framework-react-cra'
import { register as registerSolid } from '@tanstack/cta-framework-solid'
import type { FrameworkId } from '../frameworks'

export { type FrameworkId, FRAMEWORKS } from '../frameworks'

let frameworksRegistered = false

export function ensureFrameworksRegistered() {
  if (!frameworksRegistered) {
    registerReact()
    registerSolid()
    frameworksRegistered = true
  }
}

export function getFramework(id: FrameworkId = 'react-cra') {
  ensureFrameworksRegistered()
  const framework = getFrameworkById(id)
  if (!framework) {
    throw new Error(`${id} framework not found after registration`)
  }
  return framework
}

export const DEFAULT_MODE = 'file-router'
export const DEFAULT_REQUIRED_ADDONS = ['start']
