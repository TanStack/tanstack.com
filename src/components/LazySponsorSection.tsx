import React from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import SponsorPack from './SponsorPack'
import PlaceholderSponsorPack from './PlaceholderSponsorPack'

type LazySponsorSectionProps = {
  title?: string
  aspectRatio?: string
  showCTA?: boolean
  ctaClassName?: string
}

function SponsorPackWithQuery() {
  const { data: sponsors } = useSuspenseQuery({
    queryKey: ['sponsors'],
    queryFn: () => getSponsorsForSponsorPack(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return <SponsorPack sponsors={sponsors} />
}

export function LazySponsorSection({
  title = 'Sponsors',
  aspectRatio = '1/1',
  showCTA = true,
  ctaClassName = 'bg-emerald-500 text-white',
}: LazySponsorSectionProps) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '50%', // Half viewport height - triggers when about half a page away
    triggerOnce: true,
  })

  return (
    <div ref={ref} className="relative text-lg overflow-hidden">
      <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
        {title}
      </h3>
      <div
        className="my-4 flex flex-wrap mx-auto max-w-(--breakpoint-lg) relative"
        style={{ aspectRatio }}
      >
        {!isIntersecting ? (
          // Realistic placeholder bubbles - maintain exact same dimensions to prevent CLS
          <PlaceholderSponsorPack />
        ) : (
          // Load with suspense when intersecting
          <React.Suspense fallback={<PlaceholderSponsorPack />}>
            <SponsorPackWithQuery />
          </React.Suspense>
        )}
      </div>
      {showCTA ? (
        <div className="text-center">
          <a
            href="https://github.com/sponsors/tannerlinsley"
            className={twMerge(
              'inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors',
              ctaClassName
            )}
          >
            Become a Sponsor!
          </a>
        </div>
      ) : null}
    </div>
  )
}
