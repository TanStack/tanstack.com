import { Link } from '@tanstack/react-router'
import React from 'react'

declare global {
  interface Window {
    googletag: any
  }
}

const adSlots = {
  leaderboard: {
    id: 'div-gpt-ad-1738811978953-leaderboard',
    sizes: [[728, 90]],
    targeting: 'leaderboard',
    refreshInterval: 45_000, // 45 seconds
  },
  footer: {
    id: 'div-gpt-ad-1738811978953-footer',
    sizes: [[728, 90]],
    targeting: 'footer',
    refreshInterval: 45_000, // 45 seconds
  },
  rightRail: {
    id: 'div-gpt-ad-1738811978953-right-rail',
    sizes: [[300, 250]],
    targeting: 'right-side-rail',
    refreshInterval: 45_000, // 45 seconds
  },
  leftRail: {
    id: 'div-gpt-ad-1738811978953-left-rail',
    sizes: [[300, 250]],
    targeting: 'left-side-rail',
    refreshInterval: 45_000, // 45 seconds
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
    if (window.googletag) {
      window.googletag.cmd.push(function () {
        // Define all ad slots
        const slot = window.googletag
          .defineSlot('/23278945940/TopLevel', adSlot.sizes, adSlot.id)
          .addService(window.googletag.pubads())
          .setTargeting(adSlot.targeting, [adSlot.targeting])

        window.googletag.pubads().enableSingleRequest()
        window.googletag.enableServices()
        window.googletag.display(adId)

        // // Set individual refresh intervals for each ad
        // const interval = setInterval(function () {
        //   window.googletag.cmd.push(function () {
        //     window.googletag.pubads().refresh([slot])
        //   })
        // }, slot.refreshInterval)

        // return () => clearInterval(interval)
      })
    }
  }, [])

  return (
    <div {...props} className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <div id={adId} className="w-full flex-1 z-10"></div>
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

export function GadLeftRailSquare() {
  // return (
  //   <Gad
  //     adId={adSlots.leftRail.id}
  //     style={{ maxWidth: '300px', aspectRatio: '300 / 250' }}
  //   />
  // )

  return null
}

export function GadRightRailSquare() {
  return (
    <Gad
      name="rightRail"
      className="[aspect-ratio:250/250] xl:[aspect-ratio:300/250] flex items-center justify-center"
    >
      <Link
        to="/form"
        className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter h-[256px]"
      >
        <span>TanStack</span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">
          Form
        </span>
        <span className="text-xs">V1</span>
      </Link>
    </Gad>
  )
}
