import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type MaintainerAvatarImageProps = Pick<
  ComponentProps<'img'>,
  'className' | 'width' | 'height'
> & {
  src: string
  alt: string
  defer?: boolean
}

function revealImage(image: HTMLImageElement) {
  void image.decode().then(
    () => {
      image.dataset.loaded = ''
    },
    () => {
      image.dataset.failed = ''
    },
  )
}

function checkCachedImage(image: HTMLImageElement | null) {
  if (!image?.getAttribute('src') || !image.complete) return
  if (image.naturalWidth) revealImage(image)
  else image.dataset.failed = ''
}

export function MaintainerAvatarImage({
  src,
  alt,
  defer = false,
  className,
  width,
  height,
}: MaintainerAvatarImageProps) {
  return (
    <>
      <img
        key={src}
        ref={checkCachedImage}
        src={defer ? undefined : src}
        data-globe-src={defer ? src : undefined}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={(event) => revealImage(event.currentTarget)}
        onError={(event) => {
          event.currentTarget.dataset.failed = ''
        }}
        className={twMerge(
          'peer block size-full object-cover opacity-0 transition-opacity duration-300 data-[loaded]:opacity-100 motion-reduce:transition-none [@media(scripting:none)]:opacity-100',
          className,
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden bg-ds-neutral-tint-200 transition-opacity duration-300 peer-data-[loaded]:opacity-0 motion-reduce:transition-none dark:bg-ds-neutral-tint-500 before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-linear-to-r before:from-transparent before:via-ds-neutral-0/40 before:to-transparent before:[transform:translateX(-100%)] dark:before:via-ds-neutral-0/20 motion-safe:peer-[[src]:not([data-loaded],[data-failed])]:before:animate-shimmer [@media(scripting:none)]:hidden"
      />
    </>
  )
}
