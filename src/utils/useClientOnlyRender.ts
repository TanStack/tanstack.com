import { useEffect, useState } from 'react'

/**
 * Returns `true` only after the first client render. Useful for avoiding
 * hydration mismatches when markup differs between SSR and client.
 */
export function useClientOnlyRender() {
  const [rendered, setRendered] = useState(false)
  useEffect(() => {
    setRendered(true)
  }, [])
  return rendered
}
