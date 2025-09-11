import { Link } from '@tanstack/react-router'
import { ParentSize } from '@visx/responsive'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { useResizeObserver } from '~/hooks/useResizeObserver'
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
  adClassName,
  ...props
}: { name: keyof typeof gamDivs } & React.HTMLAttributes<HTMLDivElement> & {
    adClassName?: string
  }) {
  const gamId = gamDivs[name]

  const ref = React.useRef<HTMLDivElement>(null!)
  const [size, setSize] = React.useState({
    width: 0,
    height: 0,
  })

  useResizeObserver({
    ref,
    selector: (el) => el?.querySelector('iframe'),
    onResize: (rect) => {
      if (rect.width === 0 || rect.height === 0) return
      setSize({
        width: rect.width,
        height: rect.height,
      })
    },
  })

  return (
    <div style={size}>
      <div {...props}>
        <div data-fuse={gamId} className={adClassName} ref={ref} />
      </div>
    </div>
  )
}

export function GamLeader() {
  return null
}

export function GamFooter() {
  return <GamAd name="incontent_footer" style={{ maxWidth: '728px' }} />
}

export function GamRightRailSquare() {
  return (
    <GamAd
      name="mrec_1"
      className="w-[320px]"
      adClassName="scale-[.8] origin-top-left"
    />
  )
}

export function GamLeftRailSquare() {
  return (
    <GamAd
      name="mrec_2"
      className="w-[320px]"
      adClassName="scale-[.8] origin-top-left"
    />
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
