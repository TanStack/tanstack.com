import { Select, type SelectOption } from '~/components/Select'
import { findMaintainerByAuthorName } from '~/utils/authors'
import authorFallbackAvatar from '~/images/author-fallback.svg'

const ALL_AUTHORS_VALUE = 'all'

function getAuthorAvatar(name: string): string {
  return findMaintainerByAuthorName(name)?.avatar ?? authorFallbackAvatar
}

type BlogAuthorFilterProps = {
  authors: string[]
  selected: string | undefined
  onSelect: (author: string | undefined) => void
  className?: string
}

export function BlogAuthorFilter({
  authors,
  selected,
  onSelect,
  className,
}: BlogAuthorFilterProps) {
  const available: SelectOption[] = [
    { label: 'All authors', value: ALL_AUTHORS_VALUE },
    ...authors.map((name) => ({
      label: name,
      value: name,
      logo: getAuthorAvatar(name),
    })),
  ]

  // If the URL has an author that isn't in the post list, surface it anyway
  // so the trigger renders and the user can still reset to "All authors".
  if (
    selected &&
    selected !== ALL_AUTHORS_VALUE &&
    !authors.includes(selected)
  ) {
    available.push({
      label: selected,
      value: selected,
      logo: getAuthorAvatar(selected),
    })
  }

  return (
    <Select
      className={className}
      selected={selected ?? ALL_AUTHORS_VALUE}
      available={available}
      onSelect={(option) =>
        onSelect(option.value === ALL_AUTHORS_VALUE ? undefined : option.value)
      }
    />
  )
}
