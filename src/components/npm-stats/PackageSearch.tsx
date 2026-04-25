import * as React from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Search } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { twMerge } from 'tailwind-merge'
import { Spinner } from '~/components/Spinner'

type NpmSearchResult = {
  name: string
  description?: string
  version?: string
  publisher?: { username?: string }
}

const CREATE_ITEM_VALUE = '__create__'

export type PackageSearchProps = {
  onSelect: (packageName: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function PackageSearch({
  onSelect,
  placeholder = 'Search for a package...',
  autoFocus = false,
}: PackageSearchProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const [debouncedInputValue] = useDebouncedValue(inputValue, {
    wait: 150,
  })

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const hasUsableQuery = debouncedInputValue.length > 2

  const searchQuery = useQuery({
    queryKey: ['npm-search', debouncedInputValue],
    queryFn: async () => {
      const response = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
          debouncedInputValue,
        )}&size=10`,
      )
      const data = (await response.json()) as {
        objects: Array<{ package: NpmSearchResult }>
      }
      return data.objects.map((r) => r.package)
    },
    enabled: hasUsableQuery,
    placeholderData: keepPreviousData,
  })

  const searchResults = hasUsableQuery ? (searchQuery.data ?? []) : []
  const trimmedInput = debouncedInputValue.trim()
  const showCreateItem =
    hasUsableQuery &&
    trimmedInput.length > 0 &&
    !searchResults.some((d) => d.name === trimmedInput)

  const handleSelect = (value: string) => {
    if (value === CREATE_ITEM_VALUE) {
      if (!trimmedInput) return
      onSelect(trimmedInput)
    } else {
      const match = searchResults.find((item) => item.name === value)
      if (!match) return
      onSelect(match.name)
    }
    setInputValue('')
    setOpen(false)
  }

  const showList = open && inputValue.length > 0

  return (
    <div className="flex-1 relative" ref={containerRef}>
      <Command
        className="w-full"
        shouldFilter={false}
        loop
        label="Search npm packages"
      >
        <div className="flex items-center gap-1">
          <Search className="text-lg" />
          <Command.Input
            placeholder={placeholder}
            className="w-full bg-gray-500/10 rounded-md px-2 py-1 min-w-[200px] text-sm"
            value={inputValue}
            onValueChange={setInputValue}
            onFocus={() => setOpen(true)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
          />
          {searchQuery.isFetching && (
            <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center pointer-events-none">
              <Spinner className="text-sm" />
            </div>
          )}
        </div>
        <Command.List
          className={twMerge(
            'absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto divide-y divide-gray-500/10',
            !showList && 'hidden',
          )}
        >
          {inputValue.length < 3 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Keep typing to search...
            </div>
          ) : searchQuery.isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          ) : !searchResults.length && !showCreateItem ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No packages found
            </div>
          ) : null}
          {showCreateItem && (
            <Command.Item
              key={CREATE_ITEM_VALUE}
              value={CREATE_ITEM_VALUE}
              onSelect={handleSelect}
              className="px-3 py-2 cursor-pointer hover:bg-gray-500/20 data-[selected=true]:bg-gray-500/20"
            >
              <div className="font-medium">Use "{trimmedInput}"</div>
            </Command.Item>
          )}
          {searchResults.map((item) => (
            <Command.Item
              key={item.name}
              value={item.name}
              onSelect={handleSelect}
              className="px-3 py-2 cursor-pointer hover:bg-gray-500/20 data-[selected=true]:bg-gray-500/20"
            >
              <div className="font-medium">{item.name}</div>
              {item.description ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </div>
              ) : null}
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {item.version ? `v${item.version}` : ''}
                {item.version && item.publisher?.username ? ' • ' : ''}
                {item.publisher?.username}
              </div>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
