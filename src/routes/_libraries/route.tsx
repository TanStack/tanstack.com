import * as React from 'react'
import { Outlet, useLocation, createFileRoute } from '@tanstack/react-router'

import { libraries } from '~/libraries'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/_libraries')({
  staleTime: Infinity,
  component: () => {
    return (
      <LibrariesLayout>
        <Outlet />
      </LibrariesLayout>
    )
  },
})

export function LibrariesLayout({ children }: { children: React.ReactNode }) {
  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return 'to' in library && location.pathname.startsWith(library.to!)
      })
    },
  })

  return (
    <>
      {children}
      {'scarfId' in (activeLibrary || {}) ? (
        <Scarf id={(activeLibrary as { scarfId: string }).scarfId} />
      ) : null}
    </>
  )
}
