// @ts-expect-error - troika-three-text has no types
import { preloadFont } from 'troika-three-text'

// Inter Regular (latin), self-hosted. A static file rather than the site's
// variable Inter, which troika's font parser may not render the same way.
export const GAME_FONT_URL = '/fonts/Inter-Regular-latin.woff2'

// Common characters used in the game
const COMMON_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-+/()&@#$%*:;\'"'

export function preloadGameFonts(): Promise<void> {
  return new Promise((resolve) => {
    // Set a timeout in case font loading hangs
    const timeout = setTimeout(() => {
      console.warn('[FontLoader] Font preload timed out, continuing anyway')
      resolve()
    }, 5000)

    try {
      preloadFont(
        {
          font: GAME_FONT_URL,
          characters: COMMON_CHARS,
        },
        () => {
          clearTimeout(timeout)
          resolve()
        },
      )
    } catch (err) {
      console.error('[FontLoader] preloadFont error:', err)
      clearTimeout(timeout)
      resolve()
    }
  })
}
