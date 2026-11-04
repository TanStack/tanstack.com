import * as React from 'react'
import { createClientOnlyFn } from '@tanstack/react-start'
import { ClientOnly } from '@tanstack/react-router'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'

const LazyChatShell = React.lazy(
  createClientOnlyFn(() =>
    import('./ChatShell').then((module) => ({ default: module.ChatShell })),
  ),
)

export function ChatShellRoute() {
  return (
    <ClientOnly fallback={<WorkspaceSkeleton />}>
      <React.Suspense fallback={<WorkspaceSkeleton />}>
        <LazyChatShell />
      </React.Suspense>
    </ClientOnly>
  )
}
