'use client'

import * as React from 'react'
import { createPartnerPlacementPageViewSeed } from '~/utils/partner-placement'

type PartnerPlacementContextValue = {
  pageViewSeed: string
  refreshPageViewSeed: () => string
}

const PartnerPlacementContext =
  React.createContext<PartnerPlacementContextValue | null>(null)

export function PartnerPlacementProvider({
  children,
  initialPageViewSeed,
}: {
  children: React.ReactNode
  initialPageViewSeed: string
}) {
  const [pageViewSeed, setPageViewSeed] = React.useState(initialPageViewSeed)

  const refreshPageViewSeed = React.useCallback(() => {
    const nextPageViewSeed = createPartnerPlacementPageViewSeed()
    setPageViewSeed(nextPageViewSeed)
    return nextPageViewSeed
  }, [])

  const value = React.useMemo(
    () => ({
      pageViewSeed,
      refreshPageViewSeed,
    }),
    [pageViewSeed, refreshPageViewSeed],
  )

  return (
    <PartnerPlacementContext.Provider value={value}>
      {children}
    </PartnerPlacementContext.Provider>
  )
}

export function usePartnerPlacementSeed() {
  const context = React.useContext(PartnerPlacementContext)

  if (!context) {
    throw new Error(
      'usePartnerPlacementSeed must be used within PartnerPlacementProvider',
    )
  }

  return context
}
