export type SearchInputContainer = {
  querySelector: ParentNode['querySelector']
}

export function getSearchInputFromContainer(
  container: SearchInputContainer | null | undefined,
): HTMLInputElement | null {
  if (!container) {
    return null
  }

  return (
    container.querySelector<HTMLInputElement>('[cmdk-input]') ??
    container.querySelector<HTMLInputElement>(
      'input[aria-label="Search TanStack"]',
    ) ??
    container.querySelector<HTMLInputElement>('input[aria-label="Search"]') ??
    container.querySelector<HTMLInputElement>('input[type="search"]')
  )
}

export function focusSearchInputInContainer(
  container: SearchInputContainer | null | undefined,
): void {
  getSearchInputFromContainer(container)?.focus({ preventScroll: true })
}
