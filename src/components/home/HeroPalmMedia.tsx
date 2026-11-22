import * as React from 'react'
import { preload } from 'react-dom'
import { Squircle } from '~/components/Squircle'
import { useMediaQuery } from '~/utils/useMediaQuery'
import still from './hero-palm-cutout-still.webp?inline'

const motion = '/images/hero-palm-cutout.webp'
const allowMotion = '(prefers-reduced-motion: no-preference)'

export function HeroPalmMedia() {
  preload(motion, { as: 'image', type: 'image/webp', media: allowMotion })

  const permitsMotion = useMediaQuery(allowMotion)
  const [motionReady, setMotionReady] = React.useState(false)
  const showMotion = permitsMotion && motionReady

  return (
    <Squircle
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 grid place-content-center overflow-hidden rounded-xl [container-type:size] [corner-shape:squircle]"
    >
      {/* Keep the palm aligned with the original 944 × 416 composition. */}
      <div className="home-palm-sky relative aspect-[944/416] w-[max(100cqw,calc(100cqh*944/416))]">
        <div className="absolute inset-0 bg-[url('/images/hero-sky-grain.png')]" />
        <div className="absolute bottom-0 left-[calc(100%*360/944)] w-[calc(100%*260/944)]">
          {/* Keep the inlined first frame visible during the animation request. */}
          <img
            src={still}
            alt=""
            width={260}
            height={348}
            hidden={showMotion}
            className="h-auto w-full"
          />
          {(permitsMotion || motionReady) && (
            <img
              src={motion}
              alt=""
              width={260}
              height={348}
              hidden={!showMotion}
              onLoad={() => setMotionReady(true)}
              className="h-auto w-full"
            />
          )}
        </div>
      </div>
    </Squircle>
  )
}
