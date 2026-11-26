import { Popover } from '@base-ui/react/popover'
import { Select } from '@base-ui/react/select'
import {
  CaretDownIcon,
  CheckIcon,
  FunnelIcon,
  type Icon,
} from '@phosphor-icons/react'
import * as v from 'valibot'
import { libraries } from '~/libraries'
import { categoryOf, categoryTextColor } from '~/libraries/categories'
import { frameworkOptions } from '~/libraries/frameworks'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'
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
  choices: ReadonlyArray<{
    value: TValue
    label: string
    icon?: Icon
    logo?: string
    iconColor?: string
  }>
}) {
  const selectedValues = Array.isArray(selection.value) ? selection.value : []
  const selectedLogo =
    selectedValues.length === 1
      ? choices.find(({ value }) => value === selectedValues[0])?.logo
      : undefined

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
          {selectedLogo && (
            <img
              src={selectedLogo}
              alt=""
              className="size-4 shrink-0 object-contain"
            />
          )}
          <Select.Value className="min-w-0 flex-1 truncate" placeholder="All">
            {selectedValues.length > 1
              ? `${selectedValues.length} selected`
              : undefined}
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
                {choices.map(
                  ({ value, label, icon: ItemIcon, iconColor, logo }) => (
                    <Select.Item
                      key={value}
                      value={value}
                      className="group/filter-item relative flex min-h-8 cursor-pointer items-center rounded-md py-1.5 pr-7 pl-2 text-sm text-text-primary outline-none data-highlighted:bg-surface-state-hover pointer-coarse:min-h-11"
                    >
                      {ItemIcon && (
                        <ItemIcon
                          size={16}
                          className={`mr-2 shrink-0 transition-colors group-not-data-highlighted/filter-item:text-text-muted ${iconColor ?? 'text-text-muted'}`}
                          aria-hidden="true"
                        />
                      )}
                      {logo && (
                        <img
                          src={logo}
                          alt=""
                          className="mr-2 size-4 shrink-0 object-contain"
                        />
                      )}
                      <Select.ItemText>{label}</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-2 flex">
                        <CheckIcon size={14} aria-hidden="true" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ),
                )}
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
      icon: libraryIcons[id] ?? fallbackLibraryIcon,
      iconColor: categoryTextColor[categoryOf(id)],
    }))

  const hasAdvancedFilters =
    !!search.frameworks?.length ||
    !!search.specialties?.length ||
    search.groupBy !== 'none' ||
    search.sortBy !== 'none'

  return (
    <section
      aria-label="Filter and sort maintainers"
      className="flex items-end justify-between gap-2 border-b border-border-subtle pb-4"
    >
      <div className="w-48 min-w-0">
        <FilterSelect
          label="Libraries"
          choices={libraryChoices}
          multiple
          value={search.libraries ?? []}
          onValueChange={(libraries) =>
            onChange({ libraries: libraries.length ? libraries : undefined })
          }
        />
      </div>
      <Popover.Root>
        <Popover.Trigger
          aria-label={
            hasAdvancedFilters ? 'Filter and sort (active)' : 'Filter and sort'
          }
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-background-surface text-text-primary transition-colors hover:border-border-strong focus-visible:border-border-focus focus-visible:outline-none data-popup-open:bg-surface-state-hover pointer-coarse:size-11"
        >
          <FunnelIcon
            size={18}
            weight={hasAdvancedFilters ? 'fill' : 'regular'}
            aria-hidden="true"
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={4} className="z-[1190]">
            <Popover.Popup className="w-72 max-w-(--available-width) rounded-lg border border-border-default bg-background-elevated shadow-lg outline-none">
              <Popover.Title className="sr-only">Filter and sort</Popover.Title>
              <div className="grid max-h-(--available-height) gap-3 overflow-y-auto overscroll-contain p-3">
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
                  onValueChange={(sortBy) =>
                    onChange({ sortBy: sortBy ?? 'none' })
                  }
                />
                {clearAll && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="min-h-9 justify-self-end px-2 text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline pointer-coarse:min-h-11"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </section>
  )
}
