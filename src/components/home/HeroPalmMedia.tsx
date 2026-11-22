import * as React from 'react'
import { preload } from 'react-dom'
import { Squircle } from '~/components/Squircle'

const motion = '/images/hero-palm-cutout.webp'
const still = '/images/hero-palm-cutout-still.webp'
const allowMotion = '(prefers-reduced-motion: no-preference)'

export function HeroPalmMedia() {
  preload(still, { as: 'image', fetchPriority: 'high' })
  preload(motion, { as: 'image', fetchPriority: 'high', media: allowMotion })

  const [motionFailed, setMotionFailed] = React.useState(false)

  return (
    <Squircle
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 grid place-content-center overflow-hidden rounded-xl [container-type:size] [corner-shape:squircle]"
    >
      {/* Keep the palm aligned with the original 944 × 416 composition. */}
      <div className="home-palm-sky relative aspect-[944/416] w-[max(100cqw,calc(100cqh*944/416))]">
        <div className="absolute bottom-0 left-[calc(100%*360/944)] w-[calc(100%*260/944)]">
          <img
            src={still}
            alt=""
            width={260}
            height={348}
            fetchPriority="high"
            className="block h-auto w-full"
          />
          <picture className="absolute inset-0 motion-reduce:hidden">
            {!motionFailed && (
              <source type="image/webp" media={allowMotion} srcSet={motion} />
            )}
            <img
              src={still}
              alt=""
              width={260}
              height={348}
              fetchPriority="high"
              ref={(image) => {
                // A failed request can finish before hydration attaches onError.
                if (
                  image?.complete &&
                  !image.naturalWidth &&
                  image.currentSrc.endsWith(motion)
                ) {
                  setMotionFailed(true)
                }
              }}
              onError={() => setMotionFailed(true)}
              className="block h-auto w-full"
            />
          </picture>
        </div>
      </div>
    </Squircle>
  )
}
