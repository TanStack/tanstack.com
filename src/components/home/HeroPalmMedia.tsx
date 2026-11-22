import * as React from 'react'
import { Squircle } from '~/components/Squircle'
import { useMediaQuery } from '~/utils/useMediaQuery'
import still from './hero-palm-loop-still.webp?inline'

const motion = '/images/hero-palm-loop.mp4'
const allowMotion = '(prefers-reduced-motion: no-preference)'

export function HeroPalmMedia() {
  const permitsMotion = useMediaQuery(allowMotion)
  const [motionReady, setMotionReady] = React.useState(false)

  return (
    <Squircle
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 grid place-content-center overflow-hidden rounded-xl [container-type:size] [corner-shape:squircle]"
    >
      {/* Keep the palm aligned with the original 944 × 416 composition. */}
      <div className="home-palm-sky relative aspect-[944/416] w-[max(100cqw,calc(100cqh*944/416))]">
        {/* White pixels leave the CSS sky untouched, even between the moving fronds. */}
        <div className="absolute bottom-0 left-[calc(100%*360/944)] w-[calc(100%*260/944)] mix-blend-multiply">
          <img
            src={still}
            alt=""
            width={260}
            height={348}
            className="h-auto w-full"
          />
          {permitsMotion && (
            <video
              src={motion}
              autoPlay
              loop
              muted
              playsInline
              onLoadStart={() => setMotionReady(false)}
              onPlaying={() => setMotionReady(true)}
              onError={() => setMotionReady(false)}
              className={`absolute inset-0 size-full ${motionReady ? '' : 'opacity-0'}`}
            />
          )}
        </div>
      </div>
    </Squircle>
  )
}
