import { Link } from '@tanstack/react-router'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { libraries } from '~/libraries'

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
    fusetag: {
      que: {
        push: (fn: () => void) => void
      }
      pageInit: () => void
    }
  }
}

export function GamOnPageChange() {
  if (typeof window === 'undefined' || !window.fusetag) return
  window.fusetag.que.push(function () {
    window.fusetag.pageInit()
  })
}

export const GamScripts = () => (
  <>
    <script
      async
      src="https://cdn.fuseplatform.net/publift/tags/2/4019/fuse.js"
    />
    <script
      dangerouslySetInnerHTML={{
        __html: `window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    googletag.pubads().set("page_url", "https://tanstack.com/ ");
  });`,
      }}
    />
  </>
)

// GAM divs for ad placement
const gamDivs = {
  incontent_1: 'incontent_1',
  incontent_2: 'incontent_2',
  incontent_3: 'incontent_3',
  incontent_4: 'incontent_4',
  incontent_footer: 'incontent_footer',
  mrec_1: 'mrec_1',
  mrec_2: 'mrec_2',
} as const

function GamAd({
  name,
  children,
  ...props
}: { name: keyof typeof gamDivs } & React.HTMLAttributes<HTMLDivElement>) {
  const gamId = gamDivs[name]

  return (
    <div {...props} className="grid *:col-start-1 *:row-start-1">
      {/* <div className="flex items-center justify-center">{children}</div> */}
      <div data-fuse={gamId} className="w-full min-h-[200px]" />
    </div>
  )
}

export function GamLeader() {
  return null
}

export function GamFooter() {
  return <GamAd name="incontent_footer" style={{ maxWidth: '728px' }} />
}

const supportedLibraries = libraries.filter(
  (d) => d.id && d.name && d.description && d.description.length > 0
)

const libraryHalfIndex = Math.ceil(supportedLibraries.length / 2)

export function GamRightRailSquare() {
  const randomLibrary = React.useMemo(() => {
    const sampledLibraries = supportedLibraries.slice(0, libraryHalfIndex)
    const seed = Math.floor(Date.now() / (1000 * 60 * 5)) // Change seed every 5 minutes
    return sampledLibraries[seed % sampledLibraries.length]
  }, [])

  return (
    <GamAd
      name="mrec_1"
      className="aspect-250/250 xl:aspect-300/250 flex items-center justify-center"
    >
      <Link
        to={`/${randomLibrary.id}` as any}
        className="flex flex-col justify-center items-center h-[250px] w-[250px] gap-4 group"
      >
        <div className="flex items-center gap-2 flex-wrap justify-center text-3xl font-black uppercase tracking-tighter leading-none">
          <span>TanStack</span>
          <span
            className={twMerge(
              'text-transparent bg-clip-text bg-linear-to-r',
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
    </GamAd>
  )
}

export function GamLeftRailSquare() {
  const randomRemainingLibrary = React.useMemo(() => {
    const remainingLibraries = supportedLibraries.slice(libraryHalfIndex)
    const seed = Math.floor(Date.now() / (1000 * 60 * 5)) // Change seed every 5 minutes
    return remainingLibraries[seed % remainingLibraries.length]
  }, [])

  return (
    <GamAd
      name="mrec_2"
      className="aspect-250/250 xl:aspect-300/250 flex items-center justify-center"
    >
      <Link
        to={`/${randomRemainingLibrary.id}` as any}
        className="flex flex-col justify-center items-center h-[250px] w-[250px] gap-4 group"
      >
        <div className="flex items-center gap-2 flex-wrap justify-center text-3xl font-black uppercase tracking-tighter leading-none">
          <span>TanStack</span>
          <span
            className={twMerge(
              'text-transparent bg-clip-text bg-linear-to-r',
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
    </GamAd>
  )
}

// Export GAM div components for direct use
export function GamIncontent1() {
  return <GamAd name="incontent_1" />
}

export function GamIncontent2() {
  return <GamAd name="incontent_2" />
}

export function GamIncontent3() {
  return <GamAd name="incontent_3" />
}

export function GamIncontent4() {
  return <GamAd name="incontent_4" />
}

export function GamIncontentFooter() {
  return <GamAd name="incontent_footer" />
}

export function GamMrec1() {
  return <GamAd name="mrec_1" />
}

export function GamMrec2() {
  return <GamAd name="mrec_2" />
}
