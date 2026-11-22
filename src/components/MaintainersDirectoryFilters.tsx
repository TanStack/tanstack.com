import { useId } from 'react'
import * as v from 'valibot'
import { FormSelect } from '~/components/ds/ui'
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

function FilterChips<TValue extends string>({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string
  choices: ReadonlyArray<{ value: TValue; label: string }>
  selected: TValue[] | undefined
  onChange: (values: TValue[] | undefined) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-text-secondary">
        {label}
      </legend>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-2 sm:flex-wrap">
        {choices.map(({ value, label }) => {
          const pressed = selected?.includes(value) ?? false

          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              onClick={() => {
                const next = pressed
                  ? selected?.filter((item) => item !== value)
                  : [...(selected ?? []), value]
                onChange(next?.length ? next : undefined)
              }}
              className="min-h-8 shrink-0 whitespace-nowrap rounded-full border border-border-default bg-background-subtle px-3 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus aria-pressed:border-transparent aria-pressed:bg-background-inverse aria-pressed:text-text-inverse"
            >
              {label}
            </button>
          )
        })}
      </div>
    </fieldset>
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
  const id = useId()
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
      className="space-y-2 border-b border-border-subtle pb-4"
    >
      <FilterChips
        label="Libraries"
        choices={libraryChoices}
        selected={search.libraries}
        onChange={(libraries) => onChange({ libraries })}
      />
      <FilterChips
        label="Frameworks"
        choices={frameworkChoices}
        selected={search.frameworks}
        onChange={(frameworks) => onChange({ frameworks })}
      />
      <FilterChips
        label="Specialties"
        choices={specialtyChoices}
        selected={search.specialties}
        onChange={(specialties) => onChange({ specialties })}
      />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label
          htmlFor={`${id}-group`}
          className="flex flex-col gap-1 text-xs font-medium text-text-secondary"
        >
          Group by
          <FormSelect
            id={`${id}-group`}
            className="w-auto text-sm"
            value={search.groupBy}
            onChange={(event) => {
              const result = v.safeParse(groupBySchema, event.target.value)
              if (result.success) onChange({ groupBy: result.output })
            }}
          >
            <option value="none">No grouping</option>
            <option value="core">Core status</option>
            <option value="library">Library</option>
            <option value="role">Role</option>
          </FormSelect>
        </label>
        <label
          htmlFor={`${id}-sort`}
          className="flex flex-col gap-1 text-xs font-medium text-text-secondary"
        >
          Sort by
          <FormSelect
            id={`${id}-sort`}
            className="w-auto text-sm"
            value={search.sortBy}
            onChange={(event) => {
              const result = v.safeParse(sortBySchema, event.target.value)
              if (result.success) onChange({ sortBy: result.output })
            }}
          >
            <option value="none">Default</option>
            <option value="name">Name</option>
            <option value="role">Role</option>
            <option value="contributions">Contributions</option>
          </FormSelect>
        </label>
        {clearAll && (
          <button
            type="button"
            onClick={clearAll}
            className="min-h-9 text-sm text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    </section>
  )
}
