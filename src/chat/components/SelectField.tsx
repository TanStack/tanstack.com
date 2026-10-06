import {
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { PortalContainer } from './PortalContainer'
import './select-field.css'

export type SelectFieldItem = {
  value: string
  label: ReactNode
  disabled?: boolean
}

export function SelectField({
  value,
  items,
  onValueChange,
  disabled,
  id,
  name,
  className,
  ...triggerProps
}: Omit<
  ComponentPropsWithoutRef<'button'>,
  'value' | 'onChange' | 'children'
> & {
  value: string | undefined
  items: readonly SelectFieldItem[]
  onValueChange: (value: string) => void
}) {
  const container = useContext(PortalContainer)
  return (
    <Select.Root
      value={value ?? ''}
      items={items}
      disabled={disabled}
      name={name}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next)
      }}
    >
      <Select.Trigger
        {...triggerProps}
        id={id}
        type="button"
        className={['select-field-trigger', className]
          .filter(Boolean)
          .join(' ')}
      >
        <Select.Value className="select-field-value" />
        <Select.Icon className="select-field-icon">
          <ChevronDown size={14} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner
          className="select-field-positioner"
          sideOffset={5}
          align="start"
          alignItemWithTrigger={false}
          collisionPadding={8}
        >
          <Select.Popup className="select-field-popup">
            <Select.List className="select-field-list">
              {items.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="select-field-item"
                >
                  <Select.ItemIndicator className="select-field-check">
                    <Check size={14} aria-hidden />
                  </Select.ItemIndicator>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
