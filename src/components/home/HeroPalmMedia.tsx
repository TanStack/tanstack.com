import * as React from 'react'
import { preload } from 'react-dom'
import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { Squircle } from '~/components/Squircle'

const still = '/images/hero-palm-cutout-still.webp'

// Both layers use the same crop from the original 944 × 416 composition.
const frame =
  'pointer-events-none absolute inset-0 grid place-content-center overflow-hidden rounded-xl [container-type:size]'
const scene = 'relative aspect-[944/416] w-[max(100cqw,calc(100cqh*944/416))]'
const cutout =
  'absolute bottom-0 left-[calc(100%*360/944)] w-[calc(100%*260/944)]'

export function HeroPalmMedia() {
  preload(still, { as: 'image', fetchPriority: 'high' })

  const playerRef = React.useRef<HTMLDetailsElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [paused, setPaused] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopIfReduced = () => {
      if (preference.matches) player.open = false
    }
    stopIfReduced()
    // A visitor can already have closed the native control before hydration.
    setPaused(!player.open)
    const image = imageRef.current
    if (image?.complete && image.currentSrc) {
      if (image.naturalWidth > 0) setReady(!image.currentSrc.endsWith(still))
      else player.open = false
    }
    preference.addEventListener('change', stopIfReduced)
    return () => preference.removeEventListener('change', stopIfReduced)
  }, [])

  return (
    <>
      <details
        ref={playerRef}
        open
        suppressHydrationWarning
        className="peer/palm group/palm pointer-events-none absolute inset-0"
        onToggle={(event) => {
          const playing = event.currentTarget.open
          setPaused(!playing)
          if (!playing) setReady(false)
        }}
      >
        <summary className="pointer-events-auto absolute right-4 top-4 z-20 grid size-8 cursor-pointer list-none place-items-center rounded-full bg-ds-neutral-500/65 text-white backdrop-blur-sm hover:bg-ds-neutral-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:hidden [&::-webkit-details-marker]:hidden">
          <span className="hidden group-open/palm:block">
            <PauseIcon aria-hidden className="size-4" weight="fill" />
            <span className="sr-only">Pause hero animation</span>
          </span>
          <span className="group-open/palm:hidden">
            <PlayIcon aria-hidden className="size-4" weight="fill" />
            <span className="sr-only">Play hero animation</span>
          </span>
        </summary>
        <div aria-hidden className={`${frame} -z-10`}>
          <div className={scene}>
            <picture className={cutout}>
              {!paused && (
                <source
                  type="image/webp"
                  media="(prefers-reduced-motion: no-preference)"
                  srcSet="/images/hero-palm-cutout.webp"
                />
              )}
              <img
                ref={imageRef}
                src={still}
                alt=""
                width={260}
                height={348}
                loading="eager"
                onLoad={(event) =>
                  setReady(!event.currentTarget.currentSrc.endsWith(still))
                }
                onError={() => {
                  if (playerRef.current) playerRef.current.open = false
                }}
                style={{ visibility: ready ? 'visible' : 'hidden' }}
                className="block h-auto w-full"
              />
            </picture>
          </div>
        </div>
      </details>
      <Squircle
        aria-hidden
        className={`${frame} -z-20 [corner-shape:squircle] ${ready ? 'peer-open/palm:[&_img]:invisible' : ''}`}
      >
        <div className={`home-palm-sky ${scene}`}>
          <img
            src={still}
            fetchPriority="high"
            alt=""
            width={260}
            height={348}
            className={cutout}
          />
        </div>
      </Squircle>
    </>
  )
}
