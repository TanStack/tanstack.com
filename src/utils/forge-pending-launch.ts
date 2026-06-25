const FORGE_PENDING_LAUNCH_STORAGE_KEY = 'tanstack.forge.pendingLaunches.v1'
const FORGE_PENDING_LAUNCH_FAILURE_STORAGE_KEY =
  'tanstack.forge.pendingLaunchFailures.v1'
const FORGE_PENDING_LAUNCH_FAILURE_EVENT =
  'tanstack:forge-pending-launch-failed'
const FORGE_PENDING_LAUNCH_MAX_AGE_MS = 5 * 60_000

export interface ForgePendingLaunch {
  chatId: string
  clientRequestId: string
  createdAt: string
  prompt: string
  providerKey?: ForgePendingLaunchProviderKey
}

export interface ForgePendingLaunchFailure {
  chatId: string
  clientRequestId: string
  createdAt: string
  message: string
  prompt: string
}

export interface ForgePendingLaunchProviderKey {
  fingerprint: string
  model?: string
  provider: 'anthropic' | 'openai'
  sealedKey: string
}

export function writeForgePendingLaunch(launch: ForgePendingLaunch) {
  const launches = readForgePendingLaunches()

  launches[launch.chatId] = launch
  writeForgePendingLaunches(launches)
}

export function takeForgePendingLaunch(chatId: string) {
  const launches = readForgePendingLaunches()
  const launch = launches[chatId]

  if (!launch) {
    return undefined
  }

  delete launches[chatId]
  writeForgePendingLaunches(launches)

  return isFreshForgePendingLaunch(launch) ? launch : undefined
}

export function writeForgePendingLaunchFailure(
  failure: ForgePendingLaunchFailure,
) {
  const failures = readForgePendingLaunchFailures()

  failures[failure.chatId] = failure
  writeForgePendingLaunchFailures(failures)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FORGE_PENDING_LAUNCH_FAILURE_EVENT, {
        detail: failure,
      }),
    )
  }
}

export function takeForgePendingLaunchFailure(chatId: string) {
  const failures = readForgePendingLaunchFailures()
  const failure = failures[chatId]

  if (!failure) {
    return undefined
  }

  delete failures[chatId]
  writeForgePendingLaunchFailures(failures)

  return isFreshForgePendingLaunchFailure(failure) ? failure : undefined
}

export function subscribeForgePendingLaunchFailures(
  onFailure: (failure: ForgePendingLaunchFailure) => void,
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  function handleFailure(event: Event) {
    if (
      event instanceof CustomEvent &&
      isForgePendingLaunchFailure(event.detail)
    ) {
      onFailure(event.detail)
    }
  }

  window.addEventListener(FORGE_PENDING_LAUNCH_FAILURE_EVENT, handleFailure)

  return () => {
    window.removeEventListener(
      FORGE_PENDING_LAUNCH_FAILURE_EVENT,
      handleFailure,
    )
  }
}

function readForgePendingLaunches() {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.sessionStorage.getItem(FORGE_PENDING_LAUNCH_STORAGE_KEY)

  if (!raw) {
    return {}
  }

  try {
    const value: unknown = JSON.parse(raw)

    if (!isRecord(value)) {
      return {}
    }

    const launches: Record<string, ForgePendingLaunch> = {}

    for (const [chatId, launch] of Object.entries(value)) {
      if (isForgePendingLaunch(launch)) {
        launches[chatId] = launch
      }
    }

    return launches
  } catch {
    return {}
  }
}

function readForgePendingLaunchFailures() {
  if (typeof window === 'undefined') {
    return {}
  }

  const raw = window.sessionStorage.getItem(
    FORGE_PENDING_LAUNCH_FAILURE_STORAGE_KEY,
  )

  if (!raw) {
    return {}
  }

  try {
    const value: unknown = JSON.parse(raw)

    if (!isRecord(value)) {
      return {}
    }

    const failures: Record<string, ForgePendingLaunchFailure> = {}

    for (const [chatId, failure] of Object.entries(value)) {
      if (isForgePendingLaunchFailure(failure)) {
        failures[chatId] = failure
      }
    }

    return failures
  } catch {
    return {}
  }
}

function writeForgePendingLaunches(
  launches: Record<string, ForgePendingLaunch>,
) {
  if (typeof window === 'undefined') {
    return
  }

  const freshLaunches = Object.fromEntries(
    Object.entries(launches).filter(([, launch]) =>
      isFreshForgePendingLaunch(launch),
    ),
  )

  if (Object.keys(freshLaunches).length === 0) {
    window.sessionStorage.removeItem(FORGE_PENDING_LAUNCH_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(
    FORGE_PENDING_LAUNCH_STORAGE_KEY,
    JSON.stringify(freshLaunches),
  )
}

function writeForgePendingLaunchFailures(
  failures: Record<string, ForgePendingLaunchFailure>,
) {
  if (typeof window === 'undefined') {
    return
  }

  const freshFailures = Object.fromEntries(
    Object.entries(failures).filter(([, failure]) =>
      isFreshForgePendingLaunchFailure(failure),
    ),
  )

  if (Object.keys(freshFailures).length === 0) {
    window.sessionStorage.removeItem(FORGE_PENDING_LAUNCH_FAILURE_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(
    FORGE_PENDING_LAUNCH_FAILURE_STORAGE_KEY,
    JSON.stringify(freshFailures),
  )
}

function isFreshForgePendingLaunch(launch: ForgePendingLaunch) {
  const createdAt = Date.parse(launch.createdAt)

  return (
    Number.isFinite(createdAt) &&
    Date.now() - createdAt <= FORGE_PENDING_LAUNCH_MAX_AGE_MS
  )
}

function isFreshForgePendingLaunchFailure(failure: ForgePendingLaunchFailure) {
  const createdAt = Date.parse(failure.createdAt)

  return (
    Number.isFinite(createdAt) &&
    Date.now() - createdAt <= FORGE_PENDING_LAUNCH_MAX_AGE_MS
  )
}

function isForgePendingLaunch(value: unknown): value is ForgePendingLaunch {
  return (
    isRecord(value) &&
    typeof value.chatId === 'string' &&
    typeof value.clientRequestId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.prompt === 'string' &&
    (value.providerKey === undefined ||
      isForgePendingLaunchProviderKey(value.providerKey))
  )
}

function isForgePendingLaunchProviderKey(
  value: unknown,
): value is ForgePendingLaunchProviderKey {
  return (
    isRecord(value) &&
    typeof value.fingerprint === 'string' &&
    (value.model === undefined || typeof value.model === 'string') &&
    (value.provider === 'anthropic' || value.provider === 'openai') &&
    typeof value.sealedKey === 'string'
  )
}

function isForgePendingLaunchFailure(
  value: unknown,
): value is ForgePendingLaunchFailure {
  return (
    isRecord(value) &&
    typeof value.chatId === 'string' &&
    typeof value.clientRequestId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.message === 'string' &&
    typeof value.prompt === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
