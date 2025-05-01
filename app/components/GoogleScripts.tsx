import { Link } from '@tanstack/react-router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { getLibrary, libraries } from '~/libraries'

declare global {
  interface Window {
    googletag:
      | undefined
      | Partial<{
          cmd: {
            push: (fn: () => void) => void
          }
          pubads: () => {
            enableSingleRequest: () => void
            refresh: (slots: any[]) => void
          }
          enableServices: () => void
          display: (id: string) => void
          defineSlot: (
            path: string,
            sizes: [number, number][],
            id: string
          ) => {
            addService: (pubads: any) => {
              setTargeting: (key: string, value: string[]) => void
            }
          }
        }>
  }
}

const adSlots = {
  leaderboard: {
    id: 'div-gpt-ad-1738811978953-leaderboard',
    sizes: [[728, 90]],
    targeting: 'leaderboard',
    refreshInterval: 45_000,
  },
  footer: {
    id: 'div-gpt-ad-1738811978953-footer',
    sizes: [[728, 90]],
    targeting: 'footer',
    refreshInterval: 45_000,
  },
  rightRail: {
    id: 'div-gpt-ad-1738811978953-right-rail',
    sizes: [[300, 250]],
    targeting: 'right-side-rail',
    refreshInterval: 45_000,
  },
  leftRail: {
    id: 'div-gpt-ad-1738811978953-left-rail',
    sizes: [[300, 250]],
    targeting: 'left-side-rail',
    refreshInterval: 45_000,
  },
} satisfies Record<
  string,
  {
    id: string
    sizes: [number, number][]
    targeting: string
    refreshInterval: number
  }
>

export function GoogleScripts() {
  return (
    <>
      <script
        async
        src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
      ></script>
    </>
  )
}

function Gad({
  name,
  children,
  ...props
}: { name: keyof typeof adSlots } & React.HTMLAttributes<HTMLDivElement>) {
  const adSlot = adSlots[name]!
  const adId = adSlot.id

  React.useEffect(() => {
    const googletag = window.googletag
    if (!googletag) return

    const cmd = googletag.cmd
    if (!cmd) return

    cmd.push(function () {
      // Define all ad slots
      const slot = googletag
        .defineSlot?.('/23278945940/TopLevel', adSlot.sizes, adSlot.id)
        .addService(googletag.pubads?.())
        .setTargeting(adSlot.targeting, [adSlot.targeting])

      googletag.pubads?.().enableSingleRequest()
      googletag.enableServices?.()
      googletag.display?.(adId)

      // Set individual refresh intervals for each ad
      const interval = setInterval(function () {
        cmd.push(function () {
          googletag.pubads?.().refresh([slot])
        })
      }, adSlot.refreshInterval)

      return () => clearInterval(interval)
    })
  }, [])

  return (
    <div
      {...props}
      className="grid [&>*]:col-start-1 [&>*]:row-start-1"
      id={adId}
    >
      {/* <div className="w-full flex-1 z-10"></div> */}
      <div className="flex items-center justify-center">{children}</div>
    </div>
  )
}

export function GadLeader() {
  // return (
  //   <div className="overflow-hidden h-0 w-0">
  //     <Gad
  //       adId={adSlots.leaderboard.id}
  //       style={{
  //         maxWidth: '728px',
  //         aspectRatio: '728 / 90',
  //       }}
  //     />
  //   </div>
  // )

  return null
}

export function GadFooter() {
  return (
    <Gad name="footer" style={{ maxWidth: '728px', aspectRatio: '728 / 90' }} />
  )
}

const libraryHalfIndex = Math.ceil(libraries.length / 2)

export function GadRightRailSquare() {
  const randomLibrary = React.useMemo(() => {
    const sampledLibraries = libraries.slice(0, libraryHalfIndex)
    const seed = Math.floor(Date.now() / (1000 * 60 * 5)) // Change seed every 5 minutes
    return sampledLibraries[seed % sampledLibraries.length]
  }, [])

  return (
    <Gad
      name="rightRail"
      className="[aspect-ratio:250/250] xl:[aspect-ratio:300/250] flex items-center justify-center"
    >
      <Link
        to={`/${randomLibrary.id}`}
        className="flex flex-col justify-center items-center h-[250px] w-[250px] gap-4 group"
      >
        <div className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter">
          <span>TanStack</span>
          <span
            className={twMerge(
              'text-transparent bg-clip-text bg-gradient-to-r',
              randomLibrary.colorFrom,
              randomLibrary.colorTo
            )}
          >
            {randomLibrary.name.replace('TanStack ', '')}
          </span>
        </div>
        <div className="text-sm text-center">{randomLibrary.description}</div>
        <div>
          <button
            className={twMerge(
              'text-sm px-2 py-1 rounded-lg text-white font-black uppercase tracking-tighter transition-transform duration-700 group-hover:scale-[1.2]',
              randomLibrary.bgStyle
            )}
          >
            Learn More
          </button>
        </div>
      </Link>
    </Gad>
  )
}

export function GadLeftRailSquare() {
  const randomRemainingLibrary = React.useMemo(() => {
    const remainingLibraries = libraries.slice(libraryHalfIndex)
    const seed = Math.floor(Date.now() / (1000 * 60 * 5)) // Change seed every 5 minutes
    return remainingLibraries[seed % remainingLibraries.length]
  }, [])

  return (
    <Gad
      name="leftRail"
      className="[aspect-ratio:250/250] xl:[aspect-ratio:300/250] flex items-center justify-center"
    >
      <Link
        to={`/${randomRemainingLibrary.id}`}
        className="flex flex-col justify-center items-center h-[250px] w-[250px] gap-4 group"
      >
        <div className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter">
          <span>TanStack</span>
          <span
            className={twMerge(
              'text-transparent bg-clip-text bg-gradient-to-r',
              randomRemainingLibrary.colorFrom,
              randomRemainingLibrary.colorTo
            )}
          >
            {randomRemainingLibrary.name.replace('TanStack ', '')}
          </span>
        </div>
        <div className="text-sm text-center">
          {randomRemainingLibrary.description}
        </div>
        <div>
          <button
            className={twMerge(
              'text-sm px-2 py-1 rounded-lg text-white font-black uppercase tracking-tighter transition-transform duration-700 group-hover:scale-[1.2]',
              randomRemainingLibrary.bgStyle
            )}
          >
            Learn More
          </button>
        </div>
      </Link>
    </Gad>
  )
}
