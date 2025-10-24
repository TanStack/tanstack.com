import { registerFramework } from '@tanstack/cta-engine'
import { createFrameworkDefinition } from '@tanstack/cta-framework-react-cra'

let frameworkRegistered = false

export function ensureFrameworkRegistered() {
  if (frameworkRegistered) {
    return
  }

  registerFramework(createFrameworkDefinition())
  frameworkRegistered = true
}
