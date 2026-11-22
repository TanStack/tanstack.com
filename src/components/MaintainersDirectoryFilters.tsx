import { Select } from '@base-ui/react/select'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import * as v from 'valibot'
import { libraries } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { allMaintainers } from '~/libraries/maintainers'
import { libraryIdSchema } from '~/utils/schemas'

const frameworkChoices = frameworkOptions.filter(({ value }) =>
  allMaintainers.some((maintainer) =>
    maintainer.frameworkExpertise?.includes(value),
  ),
)
const specialtyLabels = new Map<string, string>()
for (const label of allMaintainers.flatMap(
  (person) => person.specialties ?? [],
)) {
  const value = label.toLowerCase()
  if (!specialtyLabels.has(value)) specialtyLabels.set(value, label)
}
const specialtyChoices = Array.from(specialtyLabels, ([value, label]) => ({
  value,
  label,
})).sort((a, b) => a.label.localeCompare(b.label))

const groupBySchema = v.picklist(['none', 'core', 'library', 'role'])
const sortBySchema = v.picklist(['none', 'name', 'role', 'contributions'])

export const maintainersDirectorySearchSchema = v.object({
  libraries: v.fallback(v.optional(v.array(libraryIdSchema)), undefined),
  frameworks: v.fallback(
    v.optional(v.array(v.picklist(frameworkChoices.map(({ value }) => value)))),
    undefined,
  ),
  specialties: v.fallback(
    v.optional(v.array(v.picklist(specialtyChoices.map(({ value }) => value)))),
    undefined,
  ),
  groupBy: v.fallback(v.optional(groupBySchema, 'none'), 'none'),
  sortBy: v.fallback(v.optional(sortBySchema, 'none'), 'none'),
})

type DirectorySearch = v.InferOutput<typeof maintainersDirectorySearchSchema>

const groupByChoices = [
  { value: 'none', label: 'No grouping' },
  { value: 'core', label: 'Core status' },
  { value: 'library', label: 'Library' },
  { value: 'role', label: 'Role' },
] satisfies ReadonlyArray<{ value: DirectorySearch['groupBy']; label: string }>

const sortByChoices = [
  { value: 'none', label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: 'role', label: 'Role' },
  { value: 'contributions', label: 'Contributions' },
] satisfies ReadonlyArray<{ value: DirectorySearch['sortBy']; label: string }>

function FilterSelect<
  TValue extends string,
  TMultiple extends boolean = false,
>({
  label,
  choices,
  ...selection
}: Pick<
  Select.Root.Props<TValue, TMultiple>,
  'multiple' | 'value' | 'onValueChange'
> & {
  label: string
  choices: ReadonlyArray<{ value: TValue; label: string }>
}) {
  const selectionCount = Array.isArray(selection.value)
    ? selection.value.length
    : 0

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Select.Root<TValue, TMultiple>
        {...selection}
        items={choices}
        modal={false}
      >
        <Select.Label className="text-xs font-medium text-text-secondary">
          {label}
        </Select.Label>
        <Select.Trigger className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-border-default bg-background-surface px-3 text-left text-sm text-text-primary transition-colors hover:border-border-strong focus-visible:border-border-focus focus-visible:outline-none pointer-coarse:min-h-11">
          <Select.Value className="min-w-0 truncate" placeholder="All">
            {selectionCount > 1 ? `${selectionCount} selected` : undefined}
          </Select.Value>
          <Select.Icon className="shrink-0 text-text-muted">
            <CaretDownIcon size={14} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="start"
            sideOffset={4}
            alignItemWithTrigger={false}
            className="z-[1200]"
          >
            <Select.Popup className="flex max-h-[min(20rem,var(--available-height))] max-w-(--available-width) min-w-(--anchor-width) flex-col overflow-hidden rounded-lg border border-border-default bg-background-elevated shadow-lg outline-none">
              <Select.List className="min-h-0 overflow-y-auto overscroll-contain p-1">
                {choices.map(({ value, label }) => (
                  <Select.Item
                    key={value}
                    value={value}
                    className="relative flex min-h-8 cursor-pointer items-center rounded-md py-1.5 pr-2 pl-7 text-sm text-text-primary outline-none data-highlighted:bg-surface-state-hover pointer-coarse:min-h-11"
                  >
                    <Select.ItemIndicator className="absolute left-2 flex">
                      <CheckIcon size={14} aria-hidden="true" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

export function MaintainersDirectoryFilters({
  search,
  onChange,
  clearAll,
}: {
  search: DirectorySearch
  onChange: (updates: Partial<DirectorySearch>) => void
  clearAll?: () => void
}) {
  const libraryChoices = libraries
    .filter(
      ({ id, visible }) => visible !== false || search.libraries?.includes(id),
    )
    .map(({ id, name }) => ({
      value: id,
      label: name.replace(/^TanStack /, ''),
    }))

  return (
    <section
      aria-label="Filter and sort maintainers"
      className="border-b border-border-subtle pb-4"
    >
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[42rem] grid-cols-5 gap-2">
          <FilterSelect
            label="Libraries"
            choices={libraryChoices}
            multiple
            value={search.libraries ?? []}
            onValueChange={(libraries) =>
              onChange({ libraries: libraries.length ? libraries : undefined })
            }
          />
          <FilterSelect
            label="Frameworks"
            choices={frameworkChoices}
            multiple
            value={search.frameworks ?? []}
            onValueChange={(frameworks) =>
              onChange({
                frameworks: frameworks.length ? frameworks : undefined,
              })
            }
          />
          <FilterSelect
            label="Specialties"
            choices={specialtyChoices}
            multiple
            value={search.specialties ?? []}
            onValueChange={(specialties) =>
              onChange({
                specialties: specialties.length ? specialties : undefined,
              })
            }
          />
          <FilterSelect
            label="Group by"
            choices={groupByChoices}
            value={search.groupBy}
            onValueChange={(groupBy) =>
              onChange({ groupBy: groupBy ?? 'none' })
            }
          />
          <FilterSelect
            label="Sort by"
            choices={sortByChoices}
            value={search.sortBy}
            onValueChange={(sortBy) => onChange({ sortBy: sortBy ?? 'none' })}
          />
        </div>
      </div>
      {clearAll && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="min-h-9 text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </section>
  )
}
