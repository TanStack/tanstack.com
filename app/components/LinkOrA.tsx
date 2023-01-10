import type { HTMLProps } from 'react'
import type { LinkProps} from '@remix-run/react';
import { Link } from '@remix-run/react'

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
      target={props.to.startsWith('http') ? '_blank' : undefined}
      prefetch="intent"
    />
  )
}
