import * as React from 'react'
import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { Squircle } from '~/components/Squircle'

export function HeroPalmMedia() {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [hasVideoSource, setHasVideoSource] = React.useState(false)
  const [isVideoReady, setIsVideoReady] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)

  const playVideo = React.useCallback((video: HTMLVideoElement) => {
    void video
      .play()
      .then(() => setIsVideoReady(true))
      .catch((error: unknown) => {
        console.error('Unable to play the homepage hero animation', error)
        setIsPlaying(false)
        setIsVideoReady(false)
      })
  }, [])

  React.useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (!reducedMotion.matches) {
      setHasVideoSource(true)
    }

    const pauseForReducedMotion = () => {
      if (reducedMotion.matches) videoRef.current?.pause()
    }

    pauseForReducedMotion()
    reducedMotion.addEventListener('change', pauseForReducedMotion)
    return () =>
      reducedMotion.removeEventListener('change', pauseForReducedMotion)
  }, [])

  React.useEffect(() => {
    if (
      !hasVideoSource ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const video = videoRef.current
    if (video) playVideo(video)
  }, [hasVideoSource, playVideo])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      if (hasVideoSource) {
        playVideo(video)
      } else {
        setHasVideoSource(true)
      }
    } else {
      video.pause()
    }
  }

  return (
    <>
      <Squircle
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden rounded-xl [corner-shape:squircle]"
      >
        <picture className="contents">
          <source
            type="image/webp"
            srcSet="/images/hero-palm-gradient-960.webp 960w, /images/hero-palm-gradient-1600.webp 1600w, /images/hero-palm-gradient-2400.webp 2400w"
            sizes="100vw"
          />
          <img
            src="/images/hero-palm-gradient.jpg"
            alt=""
            width={2400}
            height={1600}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <video
          ref={videoRef}
          src={hasVideoSource ? '/images/hero-palm-motion.mp4' : undefined}
          autoPlay
          loop
          muted
          playsInline
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onCanPlay={() => setIsVideoReady(true)}
          onError={() => setIsVideoReady(false)}
          style={{ visibility: isVideoReady ? 'visible' : 'hidden' }}
          className="absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
        />
      </Squircle>
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pause hero animation' : 'Play hero animation'}
        className="absolute right-4 top-4 z-20 grid size-8 place-items-center rounded-full bg-ds-neutral-500/65 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-ds-neutral-500/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 motion-reduce:hidden"
      >
        {isPlaying ? (
          <PauseIcon className="size-4" weight="fill" />
        ) : (
          <PlayIcon className="size-4" weight="fill" />
        )}
      </button>
    </>
  )
}
