import { libraries, type Framework, type LibrarySlim } from '~/libraries'

export function getVisibleLibraries() {
  return libraries.filter((library) => library.to && library.visible !== false)
}

export function orderLibrariesForBrowse<TLibrary extends LibrarySlim>(
  allLibraries: Array<TLibrary>,
) {
  const others = allLibraries.filter(
    (library) =>
      library.id !== 'ranger' &&
      library.id !== 'config' &&
      library.id !== 'react-charts',
  )
  const ranger = allLibraries.filter((library) => library.id === 'ranger')
  const config = allLibraries.filter((library) => library.id === 'config')

  const devtoolsIndex = others.findIndex((library) => library.id === 'devtools')

  if (devtoolsIndex === -1) {
    return [...others, ...config, ...ranger]
  }

  return [
    ...others.slice(0, devtoolsIndex + 1),
    ...config,
    ...others.slice(devtoolsIndex + 1),
    ...ranger,
  ]
}

export function getFrameworkLibraryCounts(allLibraries: Array<LibrarySlim>) {
  const counts = {} as Partial<Record<Framework, number>>

  for (const library of allLibraries) {
    for (const framework of library.frameworks) {
      counts[framework] = (counts[framework] ?? 0) + 1
    }
  }

  return counts
}
