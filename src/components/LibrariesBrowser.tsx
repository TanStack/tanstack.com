import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { CaretDown as CaretDownIcon } from '@phosphor-icons/react/CaretDown'
import { Check as CheckIcon } from '@phosphor-icons/react/Check'
import { type Framework } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import LibraryGridCard from '~/components/LibraryGridCard'
import { libraryCategories, type LibraryCategory } from '~/libraries/categories'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Eyebrow,
} from '~/components/ds/ui'
import {
  getFrameworkLibraryCounts,
  getVisibleLibraries,
  orderLibrariesForBrowse,
} from '~/libraries/browse-utils'

const CATEGORY_SECTIONS: ReadonlyArray<{
  key: LibraryCategory
  label: string
}> = [
  { key: 'framework', label: 'Framework' },
  { key: 'data', label: 'Data & State' },
  { key: 'ui', label: 'UI & UX' },
  { key: 'performance', label: 'Performance' },
  { key: 'tooling', label: 'Tooling' },
]

export function LibrariesBrowser({
  activeFramework: controlledActiveFramework,
  onFrameworkChange,
  variant,
}: {
  activeFramework?: Framework | null
  onFrameworkChange?: (framework: Framework | null) => void
  variant: 'dialog' | 'page'
}) {
  const [uncontrolledActiveFramework, setUncontrolledActiveFramework] =
    React.useState<Framework | null>(null)
  const activeFramework =
    controlledActiveFramework === undefined
      ? uncontrolledActiveFramework
      : controlledActiveFramework
  const setActiveFramework = (framework: Framework | null) => {
    if (controlledActiveFramework === undefined) {
      setUncontrolledActiveFramework(framework)
    }
    onFrameworkChange?.(framework)
  }

  const allLibraries = getVisibleLibraries()
  const ordered = orderLibrariesForBrowse(allLibraries)
  const frameworkCounts = getFrameworkLibraryCounts(allLibraries)
  const frameworksWithLibraries = frameworkOptions.filter(
    (framework) => (frameworkCounts[framework.value] ?? 0) > 0,
  )
  const activeFrameworkOption = activeFramework
    ? frameworkOptions.find((option) => option.value === activeFramework)
    : undefined
  const visibleLibraries = activeFramework
    ? ordered.filter((library) => library.frameworks.includes(activeFramework))
    : ordered

  let cardDelayBase = variant === 'dialog' ? 150 : 0
  const sections = CATEGORY_SECTIONS.map((section) => {
    const cards = visibleLibraries
      .filter(
        (library) =>
          (libraryCategories[library.id] ?? 'tooling') === section.key,
      )
      .map((library, index) => ({
        library,
        delay: cardDelayBase + Math.floor(index / 3) * 80 + (index % 3) * 25,
      }))
    if (cards.length > 0) {
      cardDelayBase += Math.ceil(cards.length / 3) * 80 + 40
    }
    return { ...section, cards }
  }).filter((section) => section.cards.length > 0)

  const title = activeFrameworkOption
    ? `TanStack ${activeFrameworkOption.label} libraries`
    : 'All Libraries'
  const description = activeFrameworkOption
    ? `Type-safe, headless TanStack primitives with ${activeFrameworkOption.label} support for routing, data, UI, performance, and tooling.`
    : 'Browse the full set of public TanStack libraries.'

  return (
    <div
      className={
        variant === 'dialog'
          ? 'mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-24 sm:px-10 sm:pt-28 lg:px-4'
          : 'mx-auto flex w-full max-w-6xl flex-col px-6 py-12 sm:px-10 sm:py-16 lg:px-4'
      }
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {activeFrameworkOption ? (
              <img
                src={activeFrameworkOption.logo}
                alt=""
                className="h-9 w-9 object-contain"
              />
            ) : null}
            {variant === 'dialog' ? (
              <DialogPrimitive.Title className="font-ds-display text-3xl font-medium text-text-primary">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <h1 className="font-ds-display text-3xl font-medium text-text-primary">
                {title}
              </h1>
            )}
          </div>
          {variant === 'dialog' ? (
            <DialogPrimitive.Description
              className={
                activeFrameworkOption
                  ? 'mt-2 max-w-2xl font-ds-mono text-xs leading-relaxed text-text-secondary'
                  : 'sr-only'
              }
            >
              {description}
            </DialogPrimitive.Description>
          ) : (
            <p
              className={
                activeFrameworkOption
                  ? 'mt-2 max-w-2xl font-ds-mono text-xs leading-relaxed text-text-secondary'
                  : 'sr-only'
              }
            >
              {description}
            </p>
          )}
        </div>

        <Dropdown>
          <DropdownTrigger
            render={
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg corner-squircle border border-black/[0.06] bg-background-surface px-3 py-2 font-ds-mono text-xs text-text-primary transition-colors hover:border-border-strong dark:border-white/[0.08] dark:bg-[#0a0a0a]"
              >
                {activeFrameworkOption ? (
                  <img
                    src={activeFrameworkOption.logo}
                    alt=""
                    className="h-4 w-4 object-contain opacity-80 brightness-0 dark:invert"
                  />
                ) : null}
                <span>
                  {activeFrameworkOption
                    ? activeFrameworkOption.label
                    : 'All frameworks'}
                </span>
                <CaretDownIcon className="size-3 text-text-secondary" />
              </button>
            }
          />
          <DropdownContent
            align="end"
            className="max-h-[60vh] overflow-y-auto font-ds-mono"
          >
            <DropdownItem onSelect={() => setActiveFramework(null)}>
              <span className="flex-1">All frameworks</span>
              <span className="text-text-muted">{ordered.length}</span>
              {activeFramework === null ? (
                <CheckIcon className="size-4 text-text-primary" />
              ) : null}
            </DropdownItem>
            <DropdownSeparator />
            {frameworksWithLibraries.map((framework) => (
              <DropdownItem
                key={framework.value}
                onSelect={() => setActiveFramework(framework.value)}
              >
                <img
                  src={framework.logo}
                  alt=""
                  loading="lazy"
                  className="h-4 w-4 object-contain opacity-80 brightness-0 dark:invert"
                />
                <span className="flex-1">{framework.label}</span>
                <span className="text-text-muted">
                  {frameworkCounts[framework.value] ?? 0}
                </span>
                {activeFramework === framework.value ? (
                  <CheckIcon className="size-4 text-text-primary" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:mt-10 sm:gap-10">
        {sections.map((section) => (
          <section key={section.key}>
            <Eyebrow category={section.key}>{section.label}</Eyebrow>
            <div className="mt-3 grid grid-cols-1 gap-0 overflow-hidden rounded-2xl corner-squircle border border-black/[0.08] divide-y divide-black/[0.08] dark:border-white/[0.08] dark:divide-white/[0.08] sm:mt-4 sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:rounded-none sm:border-0 sm:divide-y-0">
              {section.cards.map(({ library, delay }) => (
                <div
                  key={library.id}
                  className="h-full animate-library-card-reveal"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <LibraryGridCard library={library} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
