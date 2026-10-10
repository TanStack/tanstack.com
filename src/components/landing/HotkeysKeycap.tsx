export function Keycap({
  children,
  pressed = false,
  size = 'md',
}: {
  children: React.ReactNode
  pressed?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClassName = {
    sm: 'h-7 min-w-7 rounded-md px-1.5 text-ds-label-sm',
    md: 'h-10 min-w-10 rounded-lg px-2.5 text-ds-label-lg',
    lg: 'h-16 min-w-16 rounded-xl px-4 text-ds-heading-3',
  }[size]

  return (
    <kbd
      className={`inline-flex items-center justify-center border font-sans font-bold transition-[transform,box-shadow,background-color] duration-100 motion-reduce:transition-none ${sizeClassName} ${
        pressed
          ? 'translate-y-[3px] border-(--landing-accent) bg-(--landing-accent) text-(--landing-accent-ink) shadow-none'
          : 'border-border-default bg-background-surface text-text-primary shadow-[0_3px_0_var(--color-border-default)]'
      }`}
    >
      {children}
    </kbd>
  )
}

export function KeyCombo({
  keys,
  pressed = false,
  size = 'md',
}: {
  keys: ReadonlyArray<string>
  pressed?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {keys.map((key, index) => (
        <Keycap key={`${key}-${index}`} pressed={pressed} size={size}>
          {key}
        </Keycap>
      ))}
    </span>
  )
}
