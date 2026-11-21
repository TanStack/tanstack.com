import * as React from 'react'
import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { Squircle } from '~/components/Squircle'

export function HeroPalmMedia() {
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [paused, setPaused] = React.useState(false)

  const [webpOnly, setWebpOnly] = React.useState(false)
  const handleImageError = React.useCallback((image: HTMLImageElement) => {
    if (image.currentSrc.endsWith('.avif')) setWebpOnly(true)
    else setPaused(true)
  }, [])

  React.useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopIfReduced = () => {
      if (preference.matches) setPaused(true)
    }
    stopIfReduced()
    // The browser can finish loading (or fail) before hydration.
    const image = imageRef.current
    if (image?.complete && image.naturalWidth === 0) handleImageError(image)

    preference.addEventListener('change', stopIfReduced)
    return () => preference.removeEventListener('change', stopIfReduced)
  }, [handleImageError])

  return (
    <>
      <Squircle
        aria-hidden
        className="absolute inset-0 -z-10 grid place-content-center overflow-hidden rounded-xl [container-type:size] [corner-shape:squircle]"
      >
        {/* Cover the hero with the original 944 × 416 composition. The palm
            occupies x=360..620 and y=68..416 within that frame. */}
        <div className="home-palm-sky relative aspect-[944/416] w-[max(100cqw,calc(100cqh*944/416))]">
          <picture className="absolute bottom-0 left-[calc(100%*360/944)] w-[calc(100%*260/944)]">
            {!paused && !webpOnly && (
              <source
                type="image/avif"
                media="(prefers-reduced-motion: no-preference)"
                srcSet="/images/hero-palm-cutout.avif"
              />
            )}
            {!paused && (
              <source
                type="image/webp"
                media="(prefers-reduced-motion: no-preference)"
                srcSet="/images/hero-palm-cutout.webp"
              />
            )}
            <source
              type="image/webp"
              srcSet="/images/hero-palm-cutout-still.webp"
            />
            {/* Browsers can fetch the fallback during hydration. Keep it inline. */}
            <img
              ref={imageRef}
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
              alt=""
              width={260}
              height={348}
              loading="eager"
              fetchPriority="high"
              onError={(event) => handleImageError(event.currentTarget)}
              className="block h-auto w-full"
            />
          </picture>
        </div>
      </Squircle>
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? 'Play hero animation' : 'Pause hero animation'}
        className="absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-full bg-ds-neutral-500/65 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-ds-neutral-500/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 pointer-coarse:opacity-100 motion-reduce:hidden"
      >
        {paused ? (
          <PlayIcon className="size-4" weight="fill" />
        ) : (
          <PauseIcon className="size-4" weight="fill" />
        )}
      </button>
    </>
  )
}
