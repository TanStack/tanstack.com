import { useMemo } from 'react'
import { useMatches } from 'remix'

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  pathname: string
): Record<string, unknown> | undefined {
  const matches = useMatches()
  const route = useMemo(
    // @ts-ignore
    () => matches.find((match) => match.pathname === pathname),
    [matches, pathname]
  )
  return route?.data
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function slugToTitle(str: string) {
  return str
    .split('-')
    .map((word) => capitalize(word))
    .join(' ')
}

// export const tw = {
//   group: (prefix: string, tokens: string) => {
//     return tokens
//       .split(' ')
//       .map((d) => `${prefix}${d}`)
//       .join(' ')
//   },
// }

export function last<T>(arr: T[]) {
  return arr[arr.length - 1]
}
