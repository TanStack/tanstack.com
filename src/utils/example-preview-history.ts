import type { ExampleSandboxNavigationKind } from './example-sandbox.client'

export type ExamplePreviewHistory = {
  entries: Array<string>
  index: number
}

export function createExamplePreviewHistory(
  initialUrl = '/',
): ExamplePreviewHistory {
  return { entries: [initialUrl], index: 0 }
}

export function updateExamplePreviewHistory(
  current: ExamplePreviewHistory,
  navigation: {
    kind: ExampleSandboxNavigationKind
    url: string
  },
): ExamplePreviewHistory {
  const currentUrl = current.entries[current.index]
  if (navigation.url === currentUrl && navigation.kind !== 'push') {
    return current
  }

  if (navigation.kind === 'replace') {
    const entries = [...current.entries]
    entries[current.index] = navigation.url
    return { entries, index: current.index }
  }

  if (navigation.kind === 'pop') {
    const index = findNearestHistoryIndex(current, navigation.url)
    if (index !== -1) return { entries: current.entries, index }
  }

  const entries = current.entries.slice(0, current.index + 1)
  if (entries.at(-1) !== navigation.url) entries.push(navigation.url)
  return { entries, index: entries.length - 1 }
}

export function canGoBackInExamplePreview(history: ExamplePreviewHistory) {
  return history.index > 0
}

export function canGoForwardInExamplePreview(history: ExamplePreviewHistory) {
  return history.index < history.entries.length - 1
}

export function normalizeExamplePreviewUrl({
  mode,
  previewUrl,
  url,
}: {
  mode: 'client' | 'webcontainer'
  previewUrl?: string
  url: string
}) {
  if (mode === 'client') {
    return url === '/' || url.startsWith('#') ? url : undefined
  }

  if (!previewUrl) return undefined
  try {
    const preview = new URL(previewUrl)
    const reported = new URL(url, preview)
    return reported.origin === preview.origin ? reported.href : undefined
  } catch {
    return undefined
  }
}

function findNearestHistoryIndex(history: ExamplePreviewHistory, url: string) {
  let nearestIndex = -1
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const [index, entry] of history.entries.entries()) {
    if (entry !== url || index === history.index) continue
    const distance = Math.abs(index - history.index)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }

  return nearestIndex
}
