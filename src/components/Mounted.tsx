import { useMounted } from '~/hooks/useMounted'
import * as React from 'react'

export function Mounted({ children }: { children: React.ReactNode }) {
  const mounted = useMounted()

  return <React.Fragment>{mounted ? children : null}</React.Fragment>
}
