import * as React from 'react'
import { useToast } from '~/components/ToastProvider'
import { useNavigate } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import * as Menu from '@radix-ui/react-menu'
import { copyTextToClipboard } from '~/utils/browser-effects'

interface BrandContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  showTrigger?: boolean
}

export function BrandContextMenu({
  children,
  showTrigger = false,
  ...rest
}: BrandContextMenuProps) {
  const navigate = useNavigate()
  const { notify } = useToast()
  const [open, setOpen] = React.useState(false)
  const [point, setPoint] = React.useState({ x: 0, y: 0 })
  const anchorRef = React.useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
      },
    }),
    [point],
  )

  const copyText = async (text: string) => {
    try {
      await copyTextToClipboard(text)
      notify(
        <div>
          <div className="font-medium">Copied to clipboard</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            SVG markup is now in your clipboard
          </div>
        </div>,
        { id: 'svg-copied' },
      )
    } catch (err) {
      console.error('Clipboard error', err)
      notify(
        <div>
          <div className="font-medium">Copy failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Try again or download directly from the brand guide
          </div>
        </div>,
        { id: 'svg-copy-failed' },
      )
    }
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Anchor virtualRef={anchorRef} />
      <div
        role="group"
        aria-label="Logo assets"
        {...rest}
        onContextMenu={(event) => {
          rest.onContextMenu?.(event)
          if (event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          setPoint({ x: event.clientX, y: event.clientY })
          setOpen(true)
        }}
        onKeyDown={(event) => {
          rest.onKeyDown?.(event)
          if (
            event.defaultPrevented ||
            !(
              event.key === 'ContextMenu' ||
              (event.shiftKey && event.key === 'F10')
            )
          )
            return
          event.preventDefault()
          event.stopPropagation()
          const target =
            event.target instanceof HTMLElement
              ? event.target
              : event.currentTarget
          const rect = target.getBoundingClientRect()
          setPoint({ x: rect.left, y: rect.bottom })
          setOpen(true)
        }}
      >
        {children}
        {showTrigger && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-black focus:ring-2 focus:ring-blue-500 dark:focus:bg-gray-900 dark:focus:text-white"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              setPoint({ x: rect.left, y: rect.bottom })
              setOpen(true)
            }}
          >
            Logo assets
          </button>
        )}
      </div>
      <Menu.Portal>
        <Menu.Content
          side="right"
          sideOffset={2}
          align="start"
          className="dropdown-content z-[1200] min-w-48 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900/50 backdrop-blur-md"
        >
          {[
            {
              label: 'Logo — Landscape (Black)',
              url: '/images/brand/tanstack-landscape-black.svg',
            },
            {
              label: 'Logo — Landscape (White)',
              url: '/images/brand/tanstack-landscape-white.svg',
              darkBg: true,
            },
            {
              label: 'Logo — Stacked (Black)',
              url: '/images/brand/tanstack-stacked-black.svg',
            },
            {
              label: 'Logo — Stacked (White)',
              url: '/images/brand/tanstack-stacked-white.svg',
              darkBg: true,
            },
            {
              label: 'Emblem (Black)',
              url: '/images/brand/tanstack-emblem-black.svg',
            },
            {
              label: 'Emblem (White)',
              url: '/images/brand/tanstack-emblem-white.svg',
              darkBg: true,
            },
          ].map(({ label, url, darkBg }) => (
            <Menu.Item
              key={label}
              className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-700 outline-none focus:bg-gray-100 dark:text-gray-300 dark:focus:bg-gray-700/50"
              onSelect={async () => {
                try {
                  const res = await fetch(url)
                  const text = await res.text()
                  await copyText(text)
                } catch (err) {
                  console.error('Failed to copy logo', err)
                }
              }}
            >
              {label}
              <div
                className={twMerge(
                  'p-1 rounded-full',
                  darkBg
                    ? 'bg-black text-white shadow-md'
                    : 'bg-white text-black shadow-md',
                )}
              >
                <img src={url} alt={label} className="h-6" />
              </div>
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <Menu.Item
            className="cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none focus:bg-gray-100 dark:focus:bg-gray-700/50"
            onSelect={() => navigate({ to: '/ds/logos' })}
          >
            All Logo Assets
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
