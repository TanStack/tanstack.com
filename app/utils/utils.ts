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
