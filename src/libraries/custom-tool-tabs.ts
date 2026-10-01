import type { LibraryId } from './ids'
import type { FileRouteTypes } from '~/routeTree.gen'

// A "custom tool tab" is a page bolted onto a library's docs nav bar that isn't sourced from the library's docs/config.json
export type CustomToolTabId = 'catalog' | 'theme-editor'

export type CustomToolTab = {
  id: CustomToolTabId
  label: string
  to: FileRouteTypes['fullPaths']
}

export const customToolTabs: Partial<Record<LibraryId, CustomToolTab[]>> = {
  charts: [{ id: 'catalog', label: 'Examples', to: '/charts/catalog' }],
  // highlight: [
  //   {
  //     id: "theme-editor",
  //     label: "Theme Editor",
  //     to: "/highlight/$version/theme-editor",
  //   },
  // ],
}

export function isCustomToolTarget(libraryId: LibraryId, to: string) {
  return (customToolTabs[libraryId] ?? []).some(
    (tab) => to === tab.to || to.startsWith(`${tab.to}/`),
  )
}
