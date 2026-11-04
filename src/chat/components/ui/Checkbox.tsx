import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import './checkbox.css'
export function Checkbox({
  className,
  ...props
}: Omit<BaseCheckbox.Root.Props, 'className'> & { className?: string }) {
  return (
    <BaseCheckbox.Root
      {...props}
      className={['ui-checkbox', className].filter(Boolean).join(' ')}
    >
      <BaseCheckbox.Indicator>
        {props.indeterminate ? (
          <Minus size={12} aria-hidden />
        ) : (
          <Check size={12} aria-hidden />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
