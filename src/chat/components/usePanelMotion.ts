import { useState } from 'react'

/** Restore a conversation's layout instantly; animate later panel changes. */
export function usePanelMotion(scope: string, value: string | boolean) {
  const [motion, setMotion] = useState({ scope, value, enabled: false })
  if (motion.scope !== scope) {
    setMotion({ scope, value, enabled: false })
    return false
  }
  if (motion.value !== value) {
    setMotion({ scope, value, enabled: true })
    return true
  }
  return motion.enabled
}
