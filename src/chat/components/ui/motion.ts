import { useReducedMotion } from 'motion/react'

export const layoutTransition = {
  duration: 0.24,
  ease: [0.2, 0.8, 0.2, 1] as const,
}

/** Shared timing for state-driven UI. Reduced motion also removes fades. */
export function useUiTransition(duration = 0.16) {
  const reduced = useReducedMotion()
  return { duration: reduced ? 0 : duration, ease: layoutTransition.ease }
}
