import type { ReactNode } from 'react'

export function DocTitle(props: { children: ReactNode }) {
  return (
    <>
      <h1 className={`text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black`}>
        {props.children}
      </h1>
    </>
  )
}
