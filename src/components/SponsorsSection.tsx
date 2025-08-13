import * as React from 'react'
import { Await } from '@tanstack/react-router'
import { CgSpinner } from 'react-icons/cg'
import SponsorPack from '~/components/SponsorPack'
import { twMerge } from 'tailwind-merge'

type SponsorsSectionProps = {
  sponsorsPromise: Promise<any>
  title?: string
  aspectRatio?: string
  showCTA?: boolean
  ctaClassName?: string
}

export function SponsorsSection({
  sponsorsPromise,
  title = 'Sponsors',
  aspectRatio = '1/1',
  showCTA = true,
  ctaClassName = 'bg-emerald-500 text-white',
}: SponsorsSectionProps) {
  return (
    <div className="relative text-lg overflow-hidden">
      <h3 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-8">
        {title}
      </h3>
      <div
        className="my-4 flex flex-wrap mx-auto max-w-(--breakpoint-lg)"
        style={{ aspectRatio }}
      >
        <Await
          promise={sponsorsPromise}
          fallback={<CgSpinner className="text-2xl animate-spin" />}
        >
          {(sponsors: any) => <SponsorPack sponsors={sponsors} />}
        </Await>
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
