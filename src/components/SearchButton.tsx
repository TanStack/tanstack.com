import * as React from 'react'
import { BiCommand } from 'react-icons/bi'
import { MdSearch } from 'react-icons/md'
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
        'flex items-center justify-between w-full p-1 pl-2 text-left bg-gray-500/10 dark:bg-gray-500/20 rounded-lg opacity-80 hover:opacity-100 transition-opacity duration-300 gap-2',
        className
      )}
    >
      <div className="flex items-center gap-1 text-sm">
        <MdSearch className="text-lg" /> Search...
      </div>
      <div className="flex items-center bg-white/50 dark:bg-gray-500/50 rounded-md px-2 py-1 gap-1 font-bold text-xs whitespace-nowrap">
        <BiCommand /> + K
      </div>
    </button>
  )
}
