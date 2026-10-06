import { Tabs } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'
import './tab-panels.css'

export function TabPanels<T extends string>({
  label,
  value,
  onValueChange,
  options,
  children,
  panelClassName,
  orientation = 'horizontal',
}: {
  label: string
  value: T
  onValueChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  children: ReactNode
  panelClassName?: string
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <Tabs.Root
      orientation={orientation}
      className={orientation === 'vertical' ? 'ui-tabs-vertical' : undefined}
      value={value}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next as T)
      }}
    >
      <Tabs.List
        className={
          orientation === 'vertical'
            ? 'ui-tabs ui-tabs-list-vertical'
            : 'ui-tabs'
        }
        aria-label={label}
      >
        {options.map((option) => (
          <Tabs.Tab key={option.value} value={option.value} className="ui-tab">
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {options.map((option) => (
        <Tabs.Panel
          key={option.value}
          value={option.value}
          className={panelClassName}
        >
          {option.value === value ? children : null}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
