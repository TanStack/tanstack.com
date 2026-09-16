import { useRef } from 'react'
import { Button } from '@base-ui/react/button'
import { Select } from '@base-ui/react/select'
import { CaretDownIcon, CaretUpIcon, CheckIcon } from '@phosphor-icons/react'
import type { DashboardUI, SelectProps, SkinProps } from './ui'

// Adapted from shadcn/ui's MIT-licensed Base UI registry composition:
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/select.tsx
// Keep styling local to this example so it does not change the site's UI.
function ShadcnSelect({ label, value, options, onChange }: SelectProps) {
  const portal = useRef<HTMLDivElement>(null)
  return (
    <div className="dash-select dash-shadcn-field">
      <Select.Root
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
      >
        <Select.Label>{label}</Select.Label>
        <Select.Trigger data-slot="select-trigger" aria-label={label}>
          <Select.Value data-slot="select-value" />
          <Select.Icon>
            <CaretDownIcon size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal container={portal}>
          <Select.Positioner
            className="dash-shadcn-positioner"
            sideOffset={4}
            alignItemWithTrigger={false}
          >
            <Select.Popup data-slot="select-content">
              <Select.ScrollUpArrow className="dash-shadcn-scroll">
                <CaretUpIcon size={14} />
              </Select.ScrollUpArrow>
              <Select.List>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    data-slot="select-item"
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <CheckIcon size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
              <Select.ScrollDownArrow className="dash-shadcn-scroll">
                <CaretDownIcon size={14} />
              </Select.ScrollDownArrow>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <div ref={portal} className="dash-portal" />
    </div>
  )
}

const shadcnUI: DashboardUI = {
  Select: ShadcnSelect,
  Button: (props) => (
    <Button
      {...props}
      data-slot="button"
      className={`dash-button ${props.className ?? ''}`}
    />
  ),
  Panel: (props) => (
    <div
      {...props}
      data-slot="card"
      className={`dash-panel ${props.className ?? ''}`}
    />
  ),
  Table: (props) => <table {...props} data-slot="table" />,
  Head: (props) => <thead {...props} data-slot="table-header" />,
  Body: (props) => <tbody {...props} data-slot="table-body" />,
  Row: (props) => <tr {...props} data-slot="table-row" />,
  Cell: ({ heading, ...props }) =>
    heading ? (
      <th {...props} data-slot="table-head" />
    ) : (
      <td {...props} data-slot="table-cell" />
    ),
}

export default function ShadcnSkin({ children }: SkinProps) {
  return children(shadcnUI)
}
