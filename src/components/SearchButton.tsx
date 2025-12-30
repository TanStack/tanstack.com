import * as React from 'react'
import { Command, Search } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useSearchContext } from '~/contexts/SearchContext'

interface SearchButtonProps {
  className?: string
  children?: React.ReactNode
}

export function SearchButton({ className }: SearchButtonProps) {
  const { openSearch } = useSearchContext()

  return (
    <button
      onClick={openSearch}
      className={twMerge(
        'flex items-center justify-between w-full px-2 py-1 text-left bg-gray-500/10 dark:bg-gray-500/20 rounded-md opacity-80 hover:opacity-100 transition-opacity duration-300 gap-2',
        className,
      )}
    >
      <div className="flex items-center gap-1 text-xs">
        <Search className="w-3 h-3" /> Search...
      </div>
      <div className="flex items-center bg-white/50 dark:bg-gray-500/50 rounded px-1.5 py-0.5 gap-0.5 font-medium text-[10px] whitespace-nowrap">
        <Command className="w-2.5 h-2.5" /> K
      </div>
    </button>
  )
}
