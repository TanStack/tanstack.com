import React from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'
import { getSponsorsForSponsorPack } from '~/server/sponsors'
import { Button } from './Button'
import SponsorPack from './SponsorPack'
import PlaceholderSponsorPack from './PlaceholderSponsorPack'

type LazySponsorSectionProps = {
  title?: React.ReactNode
  aspectRatio?: string
  showCTA?: boolean
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
}: LazySponsorSectionProps) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '50%', // Half viewport height - triggers when about half a page away
    triggerOnce: true,
  })

  return (
    <div
      ref={ref}
      className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto"
    >
      <div className="space-y-8">
        <h3 className="text-3xl font-bold">{title}</h3>
        <div className="flex flex-wrap relative w-full" style={{ aspectRatio }}>
          {!isIntersecting ? (
            <PlaceholderSponsorPack />
          ) : (
            <React.Suspense fallback={<PlaceholderSponsorPack />}>
              <SponsorPackWithQuery />
            </React.Suspense>
          )}
        </div>
        {showCTA ? (
          <div className="flex justify-center">
            <Button as="a" href="https://github.com/sponsors/tannerlinsley">
              Become a Sponsor
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
