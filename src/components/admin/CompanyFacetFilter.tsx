import { useState } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'

export function CompanyFacetFilter({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string
  items: { name: string; value: number }[]
  selected: string[]
  onToggle: (values: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const visible = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <details className="group relative">
      <summary
        className={`flex h-7 cursor-pointer list-none items-center gap-2 rounded border px-2 text-[11px] [&::-webkit-details-marker]:hidden ${selected.length ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-gray-500/20'}`}
      >
        {label}
        {selected.length > 0 && (
          <span className="font-mono">{selected.length}</span>
        )}
        <CaretDownIcon aria-hidden="true" className="text-gray-500" />
      </summary>
      <fieldset className="absolute left-0 top-8 z-40 max-h-72 min-w-56 max-w-80 space-y-0.5 overflow-auto rounded-md border border-gray-500/25 bg-white p-1.5 shadow-lg dark:bg-gray-950">
        <legend className="sr-only">{label}</legend>
        <input
          aria-label={`Search ${label.toLowerCase()} values`}
          placeholder="Find value..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-1 w-full rounded border border-gray-500/20 bg-transparent px-2 py-1.5 text-xs"
        />
        {visible.map((item) => (
          <label
            key={item.name}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-500/10"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.name)}
              onChange={() => onToggle([item.name])}
              className="accent-emerald-600"
            />
            <span className="min-w-0 flex-1 truncate" title={item.name}>
              {item.name}
            </span>
            <span className="font-mono text-[10px] text-gray-500">
              {item.value}
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="p-2 text-xs text-gray-500">No matching values.</p>
        )}
      </fieldset>
    </details>
  )
}
