'use client'
import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'

// Markdown icon component matching the screenshot
function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2 2 2-2v6" />
      <path d="M17 9v6l-2-2" />
    </svg>
  )
}

// Claude/Anthropic icon
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
    >
      <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
    </svg>
  )
}

// ChatGPT/OpenAI icon
function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

export function CopyPageDropdown() {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const { notify } = useToast()

  const handleCopyPage = async () => {
    const url = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}.md`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch')
      const content = await response.text()
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      notify(
        <div>
          <div className="font-medium">Copied to clipboard</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Markdown content copied
          </div>
        </div>,
      )
    } catch {
      // Fallback to copying the URL
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      notify(
        <div>
          <div className="font-medium">Copied to clipboard</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Page URL copied
          </div>
        </div>,
      )
    }
  }

  const handleViewMarkdown = () => {
    const url = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}.md`
    window.open(url, '_blank')
  }

  const handleOpenInClaude = () => {
    const pageUrl = window.location.href
    const prompt = encodeURIComponent(
      `Read from this URL: ${pageUrl} and explain it to me`,
    )
    window.open(`https://claude.ai/new?q=${prompt}`, '_blank')
  }

  const handleOpenInChatGPT = () => {
    const pageUrl = window.location.href
    const prompt = encodeURIComponent(
      `Read from this URL: ${pageUrl} and explain it to me`,
    )
    window.open(`https://chatgpt.com/?q=${prompt}`, '_blank')
  }

  const menuItems = [
    {
      icon: MarkdownIcon,
      label: 'View as Markdown',
      description: 'Open this page in Markdown',
      onSelect: handleViewMarkdown,
    },
    {
      icon: ClaudeIcon,
      label: 'Open in Claude',
      description: 'Ask questions about this page',
      onSelect: handleOpenInClaude,
    },
    {
      icon: ChatGPTIcon,
      label: 'Open in ChatGPT',
      description: 'Ask questions about this page',
      onSelect: handleOpenInChatGPT,
    },
  ]

  return (
    <div
      className={twMerge(
        'inline-flex items-center',
        'rounded-md',
        'border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-800',
        'shadow-sm',
        'overflow-hidden',
      )}
    >
      <button
        onClick={handleCopyPage}
        className={twMerge(
          'inline-flex items-center justify-center gap-2',
          'py-1.5 pl-3 pr-3',
          'text-sm font-medium',
          'text-gray-700 dark:text-gray-300',
          'hover:bg-gray-50 dark:hover:bg-gray-700',
          'transition-colors duration-200',
        )}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Copy page
          </>
        )}
      </button>
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            className={twMerge(
              'inline-flex items-center justify-center',
              'px-2 py-1.5',
              'text-gray-500 dark:text-gray-400',
              'hover:bg-gray-50 dark:hover:bg-gray-700',
              'transition-colors duration-200',
            )}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="end"
            className={twMerge(
              'z-[1000] min-w-72 rounded-lg p-1.5',
              'border border-gray-200 dark:border-gray-700',
              'bg-white dark:bg-gray-800',
              'shadow-lg',
              'animate-in fade-in-0 zoom-in-95 duration-150',
            )}
          >
            {menuItems.map((item) => (
              <DropdownMenu.Item
                key={item.label}
                className={twMerge(
                  'flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5 outline-none',
                  'hover:bg-gray-100 dark:hover:bg-gray-700/50',
                  'focus:bg-gray-100 dark:focus:bg-gray-700/50',
                  'transition-colors duration-150',
                )}
                onSelect={item.onSelect}
              >
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {item.label}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </span>
                </div>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
