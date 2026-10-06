import { Input } from '@base-ui/react/input'
import './text-input.css'
export function TextInput({
  className,
  ...props
}: Omit<Input.Props, 'className'> & { className?: string }) {
  return (
    <Input
      {...props}
      className={['ui-input', className].filter(Boolean).join(' ')}
    />
  )
}
