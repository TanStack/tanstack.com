import * as React from 'react'
import { useAdsPreference } from '~/stores/userSettings'

export function AdGate({
  children,
  deferUntilReady = false,
}: {
  children: React.ReactNode
  deferUntilReady?: boolean
}) {
  const { status, adsEnabled } = useAdsPreference()
  if (status === 'unknown') return deferUntilReady ? <>{children}</> : null
  return adsEnabled ? <>{children}</> : null
}
