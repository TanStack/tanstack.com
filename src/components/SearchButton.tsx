import { useSearchContext } from '~/contexts/SearchContext'
import * as React from 'react'
import { BiCommand } from 'react-icons/bi'
import { MdSearch } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'

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
        'flex w-full items-center justify-between rounded-lg bg-gray-500/10 p-2 text-left opacity-80 transition-opacity duration-300 hover:opacity-100',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <MdSearch className="text-lg" /> Search...
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-gray-500/10 px-2 py-1 text-xs font-bold">
        <BiCommand /> + K
      </div>
    </button>
  )
}
