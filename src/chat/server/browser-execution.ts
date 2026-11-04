export interface BrowserExecutionEnvironment {
  GUM_DEV_EXECUTION?: string
  APP_MODE?: string
}
import { localDevelopment } from './development'

/** The experimental bridge is opt-in, authenticated and unavailable in builds.
 * Fixture authentication deliberately cannot authorize an execution host. */
export function browserExecutionEnabled(env: BrowserExecutionEnvironment) {
  return (
    localDevelopment() &&
    env.GUM_DEV_EXECUTION === 'enabled' &&
    env.APP_MODE !== 'fixture'
  )
}

export function browserExecutionRequestAllowed(
  request: Request,
  env: BrowserExecutionEnvironment,
) {
  const url = new URL(request.url)
  return (
    browserExecutionEnabled(env) &&
    ['http:', 'https:'].includes(url.protocol) &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  )
}
