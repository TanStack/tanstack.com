import { createContext, type RefObject } from 'react'

// Native modal dialogs occupy the browser's top layer. Their overlays must
// stay inside that layer, rather than portal into the inert document body.
export const PortalContainer = createContext<
  RefObject<HTMLElement | null> | undefined
>(undefined)
