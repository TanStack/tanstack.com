// Showcase data fetching for the game
import type { ShowcaseSlim } from './islandGenerator'
import { getFeaturedShowcases } from '~/utils/showcase.functions'

// Fetch showcases from API and transform to game format
export async function fetchGameShowcases(): Promise<ShowcaseSlim[]> {
  try {
    const result = await getFeaturedShowcases({ data: { limit: 10 } })

    return result.showcases.map((item) => ({
      id: item.showcase.id,
      name: item.showcase.name,
      url: item.showcase.url,
      screenshotUrl: item.showcase.screenshotUrl,
      tagline: item.showcase.tagline,
    }))
  } catch (error) {
    console.error('[Game] Failed to fetch showcases:', error)
    return []
  }
}
