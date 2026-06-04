import * as React from 'react'
import { Command, Search } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Button } from '~/ui'

interface SearchButtonProps {
  className?: string
  children?: React.ReactNode
}

export function SearchButton({ className }: SearchButtonProps) {
  return (
    <Button
      type="button"
      data-search-trigger
      aria-haspopup="dialog"
      variant="ghost"
      size="xs"
      className={twMerge('gap-2 bg-gray-500/5 dark:bg-gray-500/30', className)}
    >
      <Search className="w-3.5 h-3.5" />
      <span>Search...</span>
      <div className="flex items-center bg-gray-500/10 dark:bg-gray-500/30 rounded px-1 py-0.5 gap-0.5 text-[10px] whitespace-nowrap">
        <Command className="w-2.5 h-2.5" /> K
      </div>
    </Button>
  )
}
