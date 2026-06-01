'use client'

import * as React from 'react'
import { usePartnerPlacementSeed } from '~/contexts/PartnerPlacementContext'
import type { Partner } from '~/utils/partners'
import {
  getPartnerPlacementContext,
  getPartnerViewPlacementSeed,
  type PartnerPlacementContext,
  type PartnerPlacementOrderStrategy,
} from '~/utils/partner-placement'

export function usePartnerPlacementContext({
  category,
  orderStrategy,
  surface,
}: {
  category?: Partner['category']
  orderStrategy: PartnerPlacementOrderStrategy
  surface: string
}): PartnerPlacementContext {
  const { pageViewSeed } = usePartnerPlacementSeed()
  const rotationSeed =
    orderStrategy === 'tier-rotated'
      ? getPartnerViewPlacementSeed(surface, pageViewSeed)
      : undefined

  return React.useMemo(
    () =>
      getPartnerPlacementContext({
        category,
        orderStrategy,
        seed: rotationSeed,
        surface,
      }),
    [category, orderStrategy, rotationSeed, surface],
  )
}
