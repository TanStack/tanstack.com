import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import type { ReactNode } from 'react'
import './segmented-control.css'

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; icon?: ReactNode }[]
  onValueChange: (value: T) => void
}) {
  return (
    <RadioGroup
      className="ui-segmented"
      aria-label={label}
      value={value}
      onValueChange={(value) => onValueChange(value as T)}
    >
      {options.map((option) => (
        <Radio.Root
          className="ui-segment"
          value={option.value}
          key={option.value}
        >
          {option.icon}
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
