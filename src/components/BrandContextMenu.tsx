import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useToast } from '~/components/ToastProvider'
import { useNavigate } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'

interface BrandContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function BrandContextMenu({ children, ...rest }: BrandContextMenuProps) {
  const navigate = useNavigate()
  const { notify } = useToast()
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const virtualTriggerRef = React.useRef<HTMLSpanElement>(null)

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setCoords({ x: e.clientX, y: e.clientY })
    setOpen(true)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(
        <div>
          <div className="font-medium">Copied to clipboard</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            SVG markup is now in your clipboard
          </div>
        </div>
      )
    } catch (err) {
      console.error('Clipboard error', err)
      notify(
        <div>
          <div className="font-medium">Copy failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Try again or download directly from the brand guide
          </div>
        </div>
      )
    }
  }

  return (
    <div onContextMenu={onContextMenu} {...rest}>
      {children}
      <DropdownMenu.Root open={open} onOpenChange={setOpen} modal>
        <DropdownMenu.Trigger asChild>
          <span
            ref={virtualTriggerRef}
            style={{
              position: 'fixed',
              left: coords.x,
              top: coords.y,
              width: 1,
              height: 1,
            }}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            align="start"
            className="relative z-[1000] min-w-48 rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900/50 backdrop-blur-md"
          >
            {[
              {
                label: 'Logo as SVG (Black)',
                url: '/images/logos/logo-black.svg',
              },
              {
                label: 'Logo as SVG (White)',
                url: '/images/logos/logo-white.svg',
                darkBg: true,
              },
              {
                label: 'Wordmark as SVG (Black)',
                url: '/images/logos/logo-word-black.svg',
              },
              {
                label: 'Wordmark as SVG (White)',
                url: '/images/logos/logo-word-white.svg',
                darkBg: true,
              },
            ].map(({ label, url, darkBg }) => (
              <DropdownMenu.Item
                key={label}
                className={twMerge(
                  'flex cursor-pointer select-none items-center gap-2 rounded px-3 py-1 outline-none hover:bg-gray-500/20'
                )}
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
                      ? 'bg-black text-white shadow-lg shadow-white/20'
                      : 'bg-white text-black shadow-lg'
                  )}
                >
                  <img src={url} alt={label} className="h-6" />
                </div>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            <DropdownMenu.Item
              className="flex cursor-pointer select-none items-center gap-2 rounded px-3 py-2 outline-none hover:bg-gray-100 dark:hover:bg-gray-700"
              onSelect={() => navigate({ to: '/brand-guide' })}
            >
              Brand Guide & All Assets
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
