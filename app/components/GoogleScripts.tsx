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

export function GoogleScripts() {
  return (
    <>
      <script
        async
        src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
      ></script>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          (() => {
            const adSlots = ${JSON.stringify(adSlots)};

            window.googletag = window.googletag || {cmd: []};
            googletag.cmd.push(function() {
              // Define all ad slots
              Object.values(adSlots).forEach(slot => {
                googletag.defineSlot('/23278945940/TopLevel', slot.sizes, slot.id)
                  .addService(googletag.pubads())
                  .setTargeting(slot.targeting, [slot.targeting]);
              });

              googletag.pubads().enableSingleRequest();
              googletag.enableServices();
            });

            // Set individual refresh intervals for each ad
            Object.values(adSlots).forEach(slot => {
              setInterval(function() {
                googletag.cmd.push(function() {
                  googletag.pubads().refresh([googletag.slots[slot.id]]);
                });
              }, slot.refreshInterval);
            });
          })();
        `,
        }}
      />
    </>
  )
}

function Gad({
  adId,
  ...props
}: { adId: string } & React.HTMLAttributes<HTMLDivElement>) {
  React.useEffect(() => {
    window.googletag.cmd.push(function () {
      window.googletag.display(adId)
    })
  }, [])

  return <div id={adId} {...props} />
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
      className="[aspect-ratio:250/250] xl:[aspect-ratio:300/250]"
    />
  )
}
