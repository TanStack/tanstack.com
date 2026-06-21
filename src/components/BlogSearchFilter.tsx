import { Search } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

type BlogSearchFilterProps = {
  id: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export function BlogSearchFilter({
  id,
  value,
  onChange,
  className,
}: BlogSearchFilterProps) {
  return (
    <div className={twMerge('relative w-full', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Search posts..."
        className={twMerge(
          'w-full rounded-md border border-gray-500/20 bg-transparent py-1.5 pl-8 pr-2 text-sm transition-colors',
          'placeholder:text-gray-500 dark:placeholder:text-gray-400',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        )}
      />
    </div>
  )
}
