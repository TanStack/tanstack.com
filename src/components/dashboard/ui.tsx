import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
} from 'react'
export type SelectProps = {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}
export type DashboardUI = {
  Button: ComponentType<Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>>
  Select: ComponentType<SelectProps>
  Panel: ComponentType<HTMLAttributes<HTMLDivElement>>
  Table: ComponentType<TableHTMLAttributes<HTMLTableElement>>
  Head: ComponentType<HTMLAttributes<HTMLTableSectionElement>>
  Body: ComponentType<HTMLAttributes<HTMLTableSectionElement>>
  Row: ComponentType<HTMLAttributes<HTMLTableRowElement>>
  Cell: ComponentType<
    Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> & {
      heading?: boolean
    }
  >
}
export type SkinProps = {
  appearance: 'light' | 'dark'
  children: (ui: DashboardUI) => ReactNode
}
const nativeUI: DashboardUI = {
  Button: (props) => (
    <button {...props} className={`dash-button ${props.className ?? ''}`} />
  ),
  Select: ({ label, value, options, onChange }) => (
    <label className="dash-select">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  Panel: (props) => (
    <div {...props} className={`dash-panel ${props.className ?? ''}`} />
  ),
  Table: (props) => <table {...props} />,
  Head: (props) => <thead {...props} />,
  Body: (props) => <tbody {...props} />,
  Row: (props) => <tr {...props} />,
  Cell: ({ heading, ...props }) =>
    heading ? <th {...props} /> : <td {...props} />,
}
export function NativeSkin({ children }: SkinProps) {
  return children(nativeUI)
}
