import { useEffect, useRef, type ReactNode } from 'react'

export function SettingsFocusSection({
  active,
  label,
  children,
}: {
  active: boolean
  label: string
  children: ReactNode
}) {
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (active) {
      section.current?.scrollIntoView({ block: 'nearest' })
      section.current?.focus({ preventScroll: true })
    }
  }, [active])
  return (
    <section
      ref={section}
      className="settings-focus-section"
      tabIndex={-1}
      aria-label={label}
    >
      {children}
    </section>
  )
}
