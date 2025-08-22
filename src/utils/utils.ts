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

// Generates path replacing tokens with params
export function generatePath(
  id: string,
  params: Record<string, string | undefined>
) {
  let result = id.replace('routes', '').replaceAll('.', '/')
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`$${key}`, value!)
  })
  result = result.replace('$', params['*']!)

  return result
}

export function shuffle<T>(arr: T[]) {
  const random = Math.random()
  const result = arr.slice()

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }

  return result
}

export function sample(arr: any[], random = Math.random()) {
  return arr[Math.floor(random * arr.length)]
}

export function sortBy<T>(arr: T[], accessor: (d: T) => any = (d) => d): T[] {
  return arr
    .map((d: any, i: any) => [d, i])
    .sort(([a, ai], [b, bi]) => {
      a = accessor(a)
      b = accessor(b)

      if (typeof a === 'undefined') {
        if (typeof b === 'undefined') {
          return 0
        }
        return 1
      }

      a = isNumericString(a) ? Number(a) : a
      b = isNumericString(b) ? Number(b) : b

      return a === b ? ai - bi : a > b ? 1 : -1
    })
    .map((d: any) => d[0])
}

export function isNumericString(str: string): boolean {
  if (typeof str !== 'string') {
    return false // we only process strings!
  }

  return (
    !isNaN(str as unknown as number) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ) // ...and ensure strings of whitespace fail
}

/**
 * A utility function from Router, to sort an array of objects by multiple accessors.
 *
 * @param arr Unsorted array
 * @param accessors Callbacks to access the values to sort by
 * @returns Sorted array
 */
export function multiSortBy<T>(
  arr: Array<T>,
  accessors: Array<(item: T) => any> = [(d) => d]
): Array<T> {
  return arr
    .map((d, i) => [d, i] as const)
    .sort(([a, ai], [b, bi]) => {
      for (const accessor of accessors) {
        const ao = accessor(a)
        const bo = accessor(b)

        if (typeof ao === 'undefined') {
          if (typeof bo === 'undefined') {
            continue
          }
          return 1
        }

        if (ao === bo) {
          continue
        }

        return ao > bo ? 1 : -1
      }

      return ai - bi
    })
    .map(([d]) => d)
}

/**
 * A utility function from Router, to remove leading slash from a path.
 *
 * @param path Candidate path to remove leading slash
 * @returns Path without leading slash
 */
export function removeLeadingSlash(path: string): string {
  return path.replace(/^\//, '')
}

export async function logTime<T>(
  lable: string,
  fn: () => T
): Promise<T extends Promise<infer U> ? U : T> {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()
  console.log(`${lable}: ${(end - start).toLocaleString()} ms`)
  return result as any
}
