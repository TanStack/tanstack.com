import { libraries } from '~/libraries/libraries'

export function getLibraryLandingSitemapEntries(): Array<{ path: string }> {
  return libraries.flatMap((library) => {
    if (
      library.visible === false ||
      !library.latestVersion ||
      library.sitemap?.includeLandingPage !== true
    ) {
      return []
    }

    return [{ path: `/${library.id}/latest` }]
  })
}
