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
    sizes: [
      // [160, 600],
      [300, 250],
      [250, 250],
    ],
    targeting: 'right-side-rail',
    refreshInterval: 45_000, // 45 seconds
  },
  leftRail: {
    id: 'div-gpt-ad-1738811978953-left-rail',
    sizes: [
      // [160, 600],
      [300, 250],
    ],
    targeting: 'left-side-rail',
    refreshInterval: 45_000, // 45 seconds
  },
}

const googleScriptFn = (slots: typeof adSlots) => {
  window.googletag = window.googletag || { cmd: [] }
  googletag.cmd.push(function () {
    // Define all ad slots
    const slotInstances = Object.values(slots).map((slot) => {
      return googletag
        .defineSlot('/23278945940/TopLevel', slot.sizes, slot.id)
        .addService(googletag.pubads())
        .setTargeting(slot.targeting, [slot.targeting])
    })

    googletag.pubads().enableSingleRequest()
    googletag.enableServices()

    // Set individual refresh intervals for each ad
    slotInstances.forEach((slotInstance, index) => {
      const slot = Object.values(slots)[index]
      setInterval(function () {
        googletag.cmd.push(function () {
          googletag.pubads().refresh([slotInstance])
        })
      }, slot.refreshInterval)
    })
  })
}

export function GoogleScripts() {
  return (
    <>
      <script
        async
        src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
      ></script>

      <script
        dangerouslySetInnerHTML={{
          __html: `(${googleScriptFn.toString()})(${JSON.stringify(adSlots)});`,
        }}
      />
    </>
  )
}

function Gad({
  adId,
  children,
  ...props
}: { adId: string } & React.HTMLAttributes<HTMLDivElement>) {
  React.useEffect(() => {
    window.googletag.cmd.push(function () {
      window.googletag.display(adId)
    })
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
    <Gad
      adId={adSlots.footer.id}
      style={{ maxWidth: '728px', aspectRatio: '728 / 90' }}
    />
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
      adId={adSlots.rightRail.id}
      className="[aspect-ratio:250/250] xl:[aspect-ratio:300/250] flex items-center justify-center"
    >
      <Link
        to="/form"
        className="flex items-center gap-2 text-3xl font-black uppercase tracking-tighter h-full"
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
