import {
  TopBarFilter,
  FacetFilterButton,
  FilterCheckbox,
} from '~/components/FilterComponents'
import { libraries } from '~/libraries'
import { SHOWCASE_USE_CASES, type ShowcaseUseCase } from '~/db/types'
import { USE_CASE_LABELS } from '~/utils/showcase.client'

interface ShowcaseFilters {
  libraryId?: string
  useCases?: ShowcaseUseCase[]
  q?: string
}

interface ShowcaseTopBarFiltersProps {
  filters: ShowcaseFilters
  onLibraryChange: (libraryId: string | undefined) => void
  onUseCaseToggle: (useCase: ShowcaseUseCase) => void
  onClearUseCases: () => void
  onClearFilters: () => void
  onSearchChange: (q: string) => void
}

const LIBRARY_OPTIONS = libraries
  .filter((lib) => lib.name)
  .slice(0, 10)
  .map((lib) => ({
    id: lib.id,
    label: lib.name?.replace('TanStack ', '') ?? lib.id,
  }))

export function ShowcaseTopBarFilters({
  filters,
  onLibraryChange,
  onUseCaseToggle,
  onClearUseCases,
  onClearFilters,
  onSearchChange,
}: ShowcaseTopBarFiltersProps) {
  const hasActiveFilters =
    !!filters.libraryId ||
    (filters.useCases && filters.useCases.length > 0) ||
    !!filters.q

  const selectedLibrary = LIBRARY_OPTIONS.find(
    (lib) => lib.id === filters.libraryId,
  )

  return (
    <TopBarFilter
      onClearAll={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      search={{
        value: filters.q ?? '',
        onChange: onSearchChange,
        placeholder: 'Search projects...',
      }}
    >
      {/* Library Facet */}
      <FacetFilterButton
        label={
          selectedLibrary ? `Library: ${selectedLibrary.label}` : 'Library'
        }
        hasSelection={!!filters.libraryId}
        onClear={() => onLibraryChange(undefined)}
      >
        <div className="space-y-0.5">
          {LIBRARY_OPTIONS.map((lib) => (
            <FilterCheckbox
              key={lib.id}
              label={lib.label}
              checked={filters.libraryId === lib.id}
              onChange={() =>
                onLibraryChange(
                  filters.libraryId === lib.id ? undefined : lib.id,
                )
              }
            />
          ))}
        </div>
      </FacetFilterButton>

      {/* Use Case Facet */}
      <FacetFilterButton
        label="Use Case"
        hasSelection={filters.useCases && filters.useCases.length > 0}
        selectionCount={filters.useCases?.length}
        onClear={onClearUseCases}
      >
        <div className="space-y-0.5">
          {SHOWCASE_USE_CASES.map((useCase) => (
            <FilterCheckbox
              key={useCase}
              label={USE_CASE_LABELS[useCase]}
              checked={filters.useCases?.includes(useCase) ?? false}
              onChange={() => onUseCaseToggle(useCase)}
            />
          ))}
        </div>
      </FacetFilterButton>
    </TopBarFilter>
  )
}
