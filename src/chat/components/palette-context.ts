import { createContext, useContext, useEffect, useRef } from 'react'
import type { PaletteScope } from './palette-types'

export type ScopeGetter = () => PaletteScope
export const CommandContext = createContext<{
  open: () => void
  register: (id: string, scope: ScopeGetter) => () => void
} | null>(null)

/** Keep context identity separate from the hot-reloaded palette UI. */
export function usePaletteScope(scope: PaletteScope) {
  const commands = useContext(CommandContext)
  const current = useRef(scope)
  current.current = scope
  useEffect(
    () => commands?.register(scope.id, () => current.current),
    [commands, scope.id],
  )
}
