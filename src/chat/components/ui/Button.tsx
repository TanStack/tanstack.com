import { Button as BaseButton } from '@base-ui/react/button'
import { useRender } from '@base-ui/react/use-render'
import './button.css'

type Appearance = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'icon'
  className?: string
}

function appearance({
  variant = 'secondary',
  size = 'md',
  className,
}: Appearance) {
  return ['ui-button', `ui-button-${variant}`, `ui-button-${size}`, className]
    .filter(Boolean)
    .join(' ')
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: Omit<BaseButton.Props, 'className'> & Appearance) {
  return (
    <BaseButton
      {...props}
      type={type}
      className={appearance({ variant, size, className })}
    />
  )
}

/** Navigation stays a real link, including router links supplied through render. */
export function ButtonLink({
  variant,
  size,
  className,
  render,
  ref,
  ...props
}: useRender.ComponentProps<'a'> & Appearance) {
  return useRender({
    defaultTagName: 'a',
    render,
    ref,
    props: { ...props, className: appearance({ variant, size, className }) },
  })
}
