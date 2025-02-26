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
    refreshInterval: 45000, // 45 seconds
  },
  footer: {
    id: 'div-gpt-ad-1738811978953-footer',
    sizes: [[728, 90]],
    targeting: 'footer',
    refreshInterval: 45000, // 45 seconds
  },
  rightRail: {
    id: 'div-gpt-ad-1738811978953-right-rail',
    sizes: [
      [200, 200],
      [215, 180], // Common rail size that fits within 215px
      [180, 150], // Smaller option for tighter spaces
    ],
    targeting: 'right-side-rail',
    refreshInterval: 45000, // 45 seconds
  },
  leftRail: {
    id: 'div-gpt-ad-1738811978953-left-rail',
    sizes: [
      [200, 200],
      [215, 180], // Common rail size that fits within 215px
      [180, 150], // Smaller option for tighter spaces
    ],
    targeting: 'left-side-rail',
    refreshInterval: 45000, // 45 seconds
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
  return (
    <div className="overflow-hidden h-0 w-0">
      <Gad
        adId={adSlots.leaderboard.id}
        style={{
          maxWidth: '728px',
          aspectRatio: '728 / 90',
        }}
      />
    </div>
  )
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
  return (
    <div className="w-full flex justify-center">
      <Gad
        adId={adSlots.leftRail.id}
        style={{
          width: '100%',
          maxWidth: '215px',
          minHeight: '150px',
          height: 'auto',
        }}
      />
    </div>
  )
}

export function GadRightRailSquare() {
  return (
    <div className="w-full flex justify-center">
      <Gad
        adId={adSlots.rightRail.id}
        style={{
          width: '100%',
          maxWidth: '215px',
          minHeight: '150px',
          height: 'auto',
        }}
      />
    </div>
  )
}
