import { HTMLProps } from 'react'
import { LinkProps, Link } from 'remix'

export function LinkOrA(
  props: HTMLProps<HTMLAnchorElement> & LinkProps & { to?: string }
) {
  const Comp = props.to?.startsWith('http') ? 'a' : Link

  return (
    // @ts-ignore
    <Comp
      {...props}
      to={props.to.startsWith('http') ? undefined! : props.to}
      href={props.to.startsWith('http') ? props.to : undefined}
      prefetch="intent"
    />
  )
}
