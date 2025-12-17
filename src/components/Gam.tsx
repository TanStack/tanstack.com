import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link } from '@tanstack/react-router'

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
            id: string,
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
  vrec_1: 'vrec_1',
  header: 'header',
} as const

function GamAd({
  name,
  children,
  adClassName,
  className,
  placeholderClassName,
  popupPosition = 'bottom',
  borderClassName,
  style,
  ...props
}: { name: keyof typeof gamDivs } & React.HTMLAttributes<HTMLDivElement> & {
    adClassName?: string
    placeholderClassName?: string
    popupPosition?: 'top' | 'bottom'
    borderClassName?: string
  }) {
  const gamId = gamDivs[name]

  const popupClasses =
    popupPosition === 'top'
      ? 'absolute bottom-full right-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10'
      : 'absolute top-full right-0 opacity-0 group-hover:opacity-100  transition-all duration-300 z-10'

  borderClassName = twMerge('rounded-xl overflow-hidden', borderClassName)

  return (
    <div {...props} className={twMerge('relative group', className)}>
      <div
        className={twMerge(
          'absolute inset-0 bg-white/50 dark:bg-black/20 shadow-xl shadow-black/2',
          borderClassName,
          placeholderClassName,
          'pointer-events-none',
        )}
      >
        <div className="flex justify-center items-center h-full opacity-50 gap-[1px]">
          <span className="inline-block w-1 h-1 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
          <span className="inline-block w-1 h-1 rounded-full bg-gray-500 animate-bounce [animation-delay:100ms]" />
          <span className="inline-block w-1 h-1 rounded-full bg-gray-500 animate-bounce [animation-delay:200ms]" />
        </div>
        <div
          className={twMerge(
            'absolute -top-px -left-px -right-px -bottom-px border-[2px] border-gray-200 dark:border-gray-900',
            borderClassName,
          )}
        />
      </div>
      <div className="relative overflow-hidden">
        <div className={twMerge('overflow-hidden', borderClassName)}>
          <div data-fuse={gamId} className={adClassName} />
        </div>
        <div
          className={twMerge(
            'absolute -top-px -left-px -right-px -bottom-px border-[2px] border-gray-200 dark:border-gray-900',
            borderClassName,
            'pointer-events-none',
          )}
        />
      </div>
      <div className={twMerge('flex gap-1', popupClasses)}>
        <Link
          to="/ads"
          className="text-xs text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2 py-1 bg-white/90 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap"
        >
          Learn about TanStack Ads
        </Link>
        <Link
          to="/ads"
          hash="hide-ads"
          className="text-xs text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2 py-1 bg-white/90 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap"
        >
          Hide Ads
        </Link>
      </div>
    </div>
  )
}

export function GamFooter(
  props: Omit<React.ComponentProps<typeof GamAd>, 'name'>,
) {
  return (
    <GamAd
      {...props}
      name="incontent_footer"
      style={{ maxWidth: '728px', ...props.style }}
    />
  )
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

export function GamVrec1(
  props: Omit<React.ComponentProps<typeof GamAd>, 'name'>,
) {
  return <GamAd {...props} name="vrec_1" />
}

export function GamHeader(
  props: React.HTMLAttributes<HTMLDivElement> & {
    adClassName?: string
  },
) {
  return (
    <GamAd
      name="header"
      {...props}
      className={twMerge(
        'w-full max-w-[728px] flex mx-auto justify-center',
        props.className,
      )}
      adClassName={twMerge('h-[90px]', props.adClassName)}
    />
  )
}
