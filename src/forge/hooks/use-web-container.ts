import { useContext } from 'react'
import { WebContainerContext } from '~/forge/ui/web-container-provider'

export function useWebContainer() {
  const webContainer = useContext(WebContainerContext)
  return webContainer
}
