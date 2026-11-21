import * as React from 'react'
import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { Squircle } from '~/components/Squircle'

export function HeroPalmMedia() {
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopIfReduced = () => {
      if (preference.matches) setPaused(true)
    }
    stopIfReduced()
    // The browser can finish loading (or fail) before hydration.
    const image = imageRef.current
    if (image?.complete && image.naturalWidth === 0) setPaused(true)

    preference.addEventListener('change', stopIfReduced)
    return () => preference.removeEventListener('change', stopIfReduced)
  }, [])

  return (
    <>
      <Squircle
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden rounded-xl [corner-shape:squircle]"
      >
        <picture className="contents">
          {!paused && (
            <>
              <source
                type="image/webp"
                media="(prefers-reduced-motion: no-preference) and (width < 1024px)"
                srcSet="/images/hero-palm-motion-mobile.webp"
              />
              <source
                type="image/webp"
                media="(prefers-reduced-motion: no-preference)"
                srcSet="/images/hero-palm-motion.webp"
              />
            </>
          )}
          <source
            type="image/webp"
            srcSet="/images/hero-palm-gradient-960.webp 960w, /images/hero-palm-gradient-1600.webp 1600w, /images/hero-palm-gradient-2400.webp 2400w"
            sizes="100vw"
          />
          <img
            ref={imageRef}
            src="/images/hero-palm-gradient.jpg"
            alt=""
            width={2400}
            height={1058}
            loading="eager"
            fetchPriority="high"
            onError={() => setPaused(true)}
            className="h-full w-full object-cover object-center"
          />
        </picture>
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
