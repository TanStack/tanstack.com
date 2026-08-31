import type { CSSProperties, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { getOssSponsors } from '~/utils/sponsors.functions'
import { Button } from '~/ui'
import OssSponsors from './OssSponsors'
import PlaceholderOssSponsors from './PlaceholderOssSponsors'

type OssSponsorsSectionProps = {
  title?: ReactNode
  aspectRatio?: string
  maxWidth?: CSSProperties['maxWidth']
  showCTA?: boolean
}

export function OssSponsorsWithQuery() {
  const { data: sponsors } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => getOssSponsors(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (!sponsors) {
    return <PlaceholderOssSponsors />
  }

  return <OssSponsors sponsors={sponsors} />
}

export function OssSponsorsSection({
  title = 'OSS Sponsors',
  aspectRatio = '16/10',
  maxWidth,
  showCTA = true,
}: OssSponsorsSectionProps) {
  return (
    <div className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto">
      <div className="space-y-8">
        <h3 className="text-3xl font-bold">{title}</h3>
        <div
          className="relative mx-auto flex w-full flex-wrap overflow-hidden [&>div]:h-full [&>div]:w-full"
          style={{ aspectRatio, maxWidth }}
        >
          <Hydrate
            when={visible({ rootMargin: '50%' })}
            fallback={<PlaceholderOssSponsors />}
          >
            <OssSponsorsWithQuery />
          </Hydrate>
        </div>
        {showCTA ? (
          <div className="flex justify-center">
            <Button as="a" href="https://github.com/sponsors/tannerlinsley">
              Become a Sponsor
              <ArrowRightIcon className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
