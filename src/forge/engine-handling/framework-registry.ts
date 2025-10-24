let frameworkRegistered = false

export async function ensureFrameworkRegistered() {
  if (frameworkRegistered) {
    return
  }

  const { registerFramework } = await import('@tanstack/cta-engine')
  const { createFrameworkDefinition } = await import(
    '@tanstack/cta-framework-react-cra'
  )

  registerFramework(createFrameworkDefinition())
  frameworkRegistered = true
}
