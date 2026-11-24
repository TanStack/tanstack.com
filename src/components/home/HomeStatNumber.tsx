import NumberFlow, { type Format } from '@number-flow/react'
import { useHydrated } from '@tanstack/react-router'

export function HomeStatNumber({
  value,
  format,
  transformTiming,
}: {
  value: number
  format?: Format
  transformTiming?: EffectTiming
}) {
  const hydrated = useHydrated()

  // Keep visible text in the initial document before the custom element mounts.
  if (!hydrated) {
    return <span>{value.toLocaleString('en-US', format)}</span>
  }

  return (
    <NumberFlow
      value={value}
      locales="en-US"
      format={format}
      transformTiming={transformTiming}
    />
  )
}
