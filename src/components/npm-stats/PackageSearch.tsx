import * as React from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Search } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Spinner } from '~/components/Spinner'

type NpmSearchResult = {
  name: string
  description?: string
  version?: string
  label?: string
  publisher?: { username?: string }
}

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

  const searchQuery = useQuery({
    queryKey: ['npm-search', debouncedInputValue],
    queryFn: async () => {
      if (!debouncedInputValue || debouncedInputValue.length <= 2)
        return [] as Array<NpmSearchResult>

      const response = await fetch(
        `https://api.npms.io/v2/search?q=${encodeURIComponent(
          debouncedInputValue,
        )}&size=10`,
      )
      const data = (await response.json()) as {
        results: Array<{ package: NpmSearchResult }>
      }
      return data.results.map((r) => r.package)
    },
    enabled: debouncedInputValue.length > 2,
    placeholderData: keepPreviousData,
  })

  const results = React.useMemo(() => {
    const hasInputValue = searchQuery.data?.find(
      (d) => d.name === debouncedInputValue,
    )

    return [
      ...(hasInputValue
        ? []
        : [
            {
              name: debouncedInputValue,
              label: `Use "${debouncedInputValue}"`,
            },
          ]),
      ...(searchQuery.data ?? []),
    ]
  }, [searchQuery.data, debouncedInputValue])

  const handleInputChange = (value: string) => {
    setInputValue(value)
  }

  const handleSelect = (value: string) => {
    const selectedItem = results?.find((item) => item.name === value)
    if (!selectedItem) return

    onSelect(selectedItem.name)
    setInputValue('')
    setOpen(false)
  }

  return (
    <div className="flex-1" ref={containerRef}>
      <div className="relative">
        <Command className="w-full" shouldFilter={false}>
          <div className="flex items-center gap-1">
            <Search className="text-lg" />
            <Command.Input
              placeholder={placeholder}
              className="w-full bg-gray-500/10 rounded-md px-2 py-1 min-w-[200px] text-sm"
              value={inputValue}
              onValueChange={handleInputChange}
              onFocus={() => setOpen(true)}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={autoFocus}
            />
          </div>
          {searchQuery.isFetching && (
            <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
              <Spinner className="text-sm" />
            </div>
          )}
          {inputValue.length && open ? (
            <Command.List className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto divide-y divide-gray-500/10">
              {inputValue.length < 3 ? (
                <div className="px-3 py-2">Keep typing to search...</div>
              ) : searchQuery.isLoading ? (
                <div className="px-3 py-2 flex items-center gap-2">
                  Searching...
                </div>
              ) : !results?.length ? (
                <div className="px-3 py-2">No packages found</div>
              ) : null}
              {results?.map((item) => (
                <Command.Item
                  key={item.name}
                  value={item.name}
                  onSelect={handleSelect}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-500/20 data-[selected=true]:bg-gray-500/20"
                >
                  <div className="font-medium">{item.label || item.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {item.description}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {item.version ? `v${item.version}• ` : ''}
                    {item.publisher?.username}
                  </div>
                </Command.Item>
              ))}
            </Command.List>
          ) : null}
        </Command>
      </div>
    </div>
  )
}
