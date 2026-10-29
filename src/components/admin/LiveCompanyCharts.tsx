export function CompanyBreakdownChart({
  title,
  items,
  color,
  selected,
  onSelect,
  note,
}: {
  title: string
  items: { name: string; value: number; values: string[] }[]
  color: string
  selected: string[]
  onSelect: (values: string[]) => void
  note?: string
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value))
  return (
    <section className="min-w-0 px-4 py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold" title={note}>
          {title}
        </h2>
        <span className="text-[10px] text-gray-500">Companies</span>
      </div>
      {!items.length ? (
        <p className="flex h-28 items-center text-xs text-gray-500">
          No companies match.
        </p>
      ) : (
        <ul className="space-y-0" aria-label={title}>
          {items.map((item) => {
            const active = item.values.every((value) =>
              selected.includes(value),
            )
            return (
              <li key={item.name}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(item.values)}
                  className={`relative flex h-5 w-full items-center gap-2 overflow-hidden rounded-sm px-2 text-left text-[11px] hover:bg-gray-500/10 focus-visible:outline focus-visible:outline-emerald-500 ${active ? 'ring-1 ring-inset ring-current' : ''}`}
                  title={`${item.name}: ${item.value} companies. Click to ${active ? 'remove' : 'apply'} filter.`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 opacity-15"
                    style={{
                      width: `${(item.value / maximum) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                  <span className="relative min-w-0 flex-1 truncate">
                    {item.name}
                  </span>
                  <span className="relative font-mono tabular-nums">
                    {item.value}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
