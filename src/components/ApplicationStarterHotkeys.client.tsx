import * as React from 'react'
import { useHeldKeys, useHotkey } from '@tanstack/react-hotkeys'

interface ApplicationStarterHotkeysProps {
  onAnalyze: () => void
  onModKeyChange: (isHeld: boolean) => void
  promptFocused: boolean
}

export function ApplicationStarterHotkeys({
  onAnalyze,
  onModKeyChange,
  promptFocused,
}: ApplicationStarterHotkeysProps) {
  const heldKeys = useHeldKeys()
  const isModHeld = heldKeys.includes('Meta') || heldKeys.includes('Control')

  useHotkey('Mod+Enter', () => {
    if (!promptFocused) {
      return
    }

    onAnalyze()
  })

  React.useEffect(() => {
    onModKeyChange(isModHeld)
    return () => onModKeyChange(false)
  }, [isModHeld, onModKeyChange])

  return null
}
