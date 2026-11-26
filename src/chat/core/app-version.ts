declare const __GUM_BUILD_ID__: string

export const appBuildId =
  typeof __GUM_BUILD_ID__ === 'undefined' ? 'development' : __GUM_BUILD_ID__

export function availableAppBuild(
  current: string,
  value: unknown,
): string | undefined {
  if (current === 'development' || !value || typeof value !== 'object') return
  const build = (value as { build?: unknown }).build
  if (
    typeof build === 'string' &&
    /^[a-f0-9]{64}$/.test(build) &&
    build !== current
  )
    return build
}
