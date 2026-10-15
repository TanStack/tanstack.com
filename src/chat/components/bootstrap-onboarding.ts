import type { Onboarding } from '../core/onboarding'

type BootstrapSetup = {
  user: { id: string }
  workspace: { id: string; name: string }
  onboarding: Onboarding
}

/** Keep a late bootstrap read from undoing an acknowledged account setup. */
export function applyBootstrapOnboarding<T extends BootstrapSetup>(
  current: T,
  userId: string,
  incoming: Onboarding,
): T {
  if (
    current.user.id !== userId ||
    current.onboarding.revision > incoming.revision
  )
    return current
  return {
    ...current,
    onboarding: incoming,
    workspace:
      current.workspace.id === incoming.workspaceId
        ? { ...current.workspace, name: incoming.workspaceName }
        : current.workspace,
  }
}

export function mergeBootstrapOnboarding<T extends BootstrapSetup>(
  previous: T | undefined,
  incoming: T,
): T {
  return previous?.user.id === incoming.user.id &&
    previous.onboarding.revision > incoming.onboarding.revision
    ? applyBootstrapOnboarding(incoming, previous.user.id, previous.onboarding)
    : incoming
}
