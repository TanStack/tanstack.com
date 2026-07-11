import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link } from '@tanstack/react-router'
import { CaretDown, CircleNotch, User } from '@phosphor-icons/react'
import type { MarkdownHeading } from '~/utils/markdown'
import type { LibraryId } from '~/libraries/ids'

/**
 * New-system DS components — built on the Figma semantic tokens (action-*,
 * background-*, text-*, border-*, status-*) so they respond to the theme and
 * carry the new brand palette. Used by the /ds style book and /staging pages.
 *
 * These intentionally MIRROR the production components' APIs (~/ui, ~/components)
 * so pages can swap imports 1:1, but they do NOT touch production — the live
 * site keeps its current components until these are promoted.
 */

/* ----------------------------------------------------------------- Button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'link'
type ButtonColor =
  | 'blue'
  | 'green'
  | 'red'
  | 'orange'
  | 'purple'
  | 'gray'
  | 'emerald'
  | 'cyan'
  | 'yellow'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md'
type ButtonRounded = 'none' | 'md' | 'lg' | 'full'

// Polymorphic: defaults to <button>, but `as={Link}` / `as="a"` lets a CTA
// render as a link while keeping the button styling. Mirrors the production
// Button's API (src/ui/Button.tsx) so pages can swap imports 1:1.
type ButtonOwnProps<TElement extends React.ElementType = 'button'> = {
  as?: TElement
  children: React.ReactNode
  variant?: ButtonVariant
  color?: ButtonColor
  size?: ButtonSize
  rounded?: ButtonRounded
  className?: string
}

type ButtonProps<TElement extends React.ElementType = 'button'> =
  ButtonOwnProps<TElement> &
    Omit<React.ComponentPropsWithRef<TElement>, keyof ButtonOwnProps<TElement>>

type ButtonComponent = <TElement extends React.ElementType = 'button'>(
  props: ButtonProps<TElement>,
) => React.ReactNode

type ButtonInnerProps = ButtonOwnProps & Record<string, unknown>

// Color set mapped onto the new palette (brand blue = the teal #013e53).
const primaryColorStyles: Record<ButtonColor, string> = {
  blue: 'bg-ds-blue-500 text-white border-ds-blue-500 hover:bg-ds-blue-400',
  green: 'bg-ds-green-400 text-white border-ds-green-400 hover:bg-ds-green-300',
  red: 'bg-ds-terracotta-400 text-white border-ds-terracotta-400 hover:bg-ds-terracotta-300',
  orange:
    'bg-ds-terracotta-300 text-white border-ds-terracotta-300 hover:bg-ds-terracotta-200',
  purple:
    'bg-ds-purple-400 text-white border-ds-purple-400 hover:bg-ds-purple-300',
  gray: 'bg-ds-neutral-400 text-white border-ds-neutral-400 hover:bg-ds-neutral-300',
  emerald:
    'bg-ds-green-400 text-white border-ds-green-400 hover:bg-ds-green-300',
  cyan: 'bg-lib-start text-white border-lib-start hover:bg-lib-start/90',
  yellow:
    'bg-ds-amber-300 text-ds-neutral-500 border-ds-amber-300 hover:bg-ds-amber-200',
}

const iconColorStyles: Record<ButtonColor, string> = {
  blue: 'text-ds-blue-500 hover:bg-ds-blue-500/10',
  green: 'text-ds-green-400 hover:bg-ds-green-400/10',
  red: 'text-ds-terracotta-400 hover:bg-ds-terracotta-400/10',
  orange: 'text-ds-terracotta-300 hover:bg-ds-terracotta-300/10',
  purple: 'text-ds-purple-400 hover:bg-ds-purple-400/10',
  gray: 'text-text-muted hover:bg-background-subtle',
  emerald: 'text-ds-green-400 hover:bg-ds-green-400/10',
  cyan: 'text-lib-start hover:bg-lib-start/10',
  yellow: 'text-ds-amber-400 hover:bg-ds-amber-400/10',
}

const linkColorStyles: Record<ButtonColor, string> = {
  blue: 'text-ds-blue-500 hover:text-ds-blue-400',
  green: 'text-ds-green-400 hover:text-ds-green-300',
  red: 'text-ds-terracotta-400 hover:text-ds-terracotta-300',
  orange: 'text-ds-terracotta-300 hover:text-ds-terracotta-200',
  purple: 'text-ds-purple-400 hover:text-ds-purple-300',
  gray: 'text-text-secondary hover:text-text-primary',
  emerald: 'text-ds-green-400 hover:text-ds-green-300',
  cyan: 'text-lib-start hover:text-lib-start/80',
  yellow: 'text-ds-amber-400 hover:text-ds-amber-300',
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.18)] hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-0 active:shadow-[0_1px_2px_0_rgba(0,0,0,0.12)]',
  secondary:
    'bg-action-secondary text-text-primary hover:bg-action-secondary-hover border-transparent font-medium shadow-sm hover:-translate-y-px hover:shadow-md active:translate-y-0',
  ghost:
    'border border-border-default text-text-primary hover:bg-background-subtle hover:border-border-strong font-medium hover:shadow-sm',
  icon: 'border-transparent active:scale-90',
  link: 'border-transparent font-medium underline-offset-2 hover:underline',
}

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1.5 text-xs',
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  'icon-sm': 'p-1.5',
  'icon-md': 'p-2',
}

const roundedStyles: Record<ButtonRounded, string> = {
  none: 'rounded-none',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background-default'

function getDefaultSize(variant: ButtonVariant): ButtonSize {
  if (variant === 'icon') return 'icon-md'
  return 'md'
}

function getDefaultRounded(size: ButtonSize): ButtonRounded {
  if (size === 'xs' || size === 'sm') return 'md'
  return 'lg'
}

export const Button: ButtonComponent = React.forwardRef<
  HTMLElement,
  ButtonInnerProps
>(function Button(props, ref) {
  const {
    as,
    children,
    variant = 'primary',
    color = 'blue',
    size,
    rounded,
    className,
    ...rest
  } = props as ButtonOwnProps & Record<string, unknown>
  const Component = as || 'button'
  const resolvedSize = size ?? getDefaultSize(variant)
  const resolvedRounded = rounded ?? getDefaultRounded(resolvedSize)
  const colorStyles =
    variant === 'primary'
      ? primaryColorStyles[color]
      : variant === 'icon'
        ? iconColorStyles[color]
        : variant === 'link'
          ? linkColorStyles[color]
          : ''

  return React.createElement(
    Component,
    {
      ref,
      className: twMerge(
        baseStyles,
        variantStyles[variant],
        sizeStyles[resolvedSize],
        roundedStyles[resolvedRounded],
        colorStyles,
        className,
      ),
      ...rest,
    },
    children,
  )
}) as unknown as ButtonComponent

/* ------------------------------------------------------------------ Badge -- */

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'teal'
  | 'orange'

const badgeVariantStyles: Record<BadgeVariant, string> = {
  default: 'bg-background-subtle text-text-secondary',
  success: 'bg-status-success-bg text-text-success',
  warning: 'bg-status-warning-bg text-text-warning',
  error: 'bg-status-error-bg text-text-error',
  info: 'bg-status-info-bg text-text-info',
  purple: 'bg-accent-creative/15 text-accent-creative',
  teal: 'bg-lib-start/15 text-lib-start',
  orange: 'bg-accent-warm/20 text-accent-warm',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        badgeVariantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- Eyebrow -- */

type EyebrowTone = 'muted' | 'secondary' | 'accent'

const eyebrowToneStyles: Record<EyebrowTone, string> = {
  muted: 'text-text-muted',
  secondary: 'text-text-secondary',
  accent: 'text-text-accent',
}

// Libraries that ship a `--color-lib-*` brand token. Written as literal classes
// so Tailwind's JIT emits each `text-lib-*` utility. Libraries without a brand
// token (e.g. ranger, config) simply fall back to the neutral tone.
const eyebrowLibraryStyles: Partial<Record<LibraryId, string>> = {
  start: 'text-lib-start',
  router: 'text-lib-router',
  query: 'text-lib-query',
  table: 'text-lib-table',
  db: 'text-lib-db',
  ai: 'text-lib-ai',
  form: 'text-lib-form',
  virtual: 'text-lib-virtual',
  pacer: 'text-lib-pacer',
  hotkeys: 'text-lib-hotkeys',
  store: 'text-lib-store',
  devtools: 'text-lib-devtools',
  cli: 'text-lib-cli',
  intent: 'text-lib-intent',
}

/**
 * Section eyebrow / kicker — the small uppercase label that sits above a
 * heading. Locks in the DS `mono-caps` role (IBM Plex Mono, 12px, +1.5px
 * tracking) plus the inline icon layout, so every eyebrow across the site stays
 * on-system instead of hand-stacking `text-xs font-black uppercase`.
 *
 * Color resolves in priority order: `library` (brand the eyebrow by the
 * category it sits within, via that library's `--color-lib-*` token) →
 * `className` override → `tone` (neutral default). Pass a `library` to brand it,
 * omit it for a neutral eyebrow.
 */
export function Eyebrow({
  children,
  icon,
  tone = 'secondary',
  library,
  className,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  tone?: EyebrowTone
  /** Brand the eyebrow by the library/category it's nested within. Falls back
   *  to `tone` when unset or when the library has no brand token. */
  library?: LibraryId
  className?: string
}) {
  const color =
    (library && eyebrowLibraryStyles[library]) ?? eyebrowToneStyles[tone]

  // The `mono-caps` type role is a fixed base — never merged away — so the DS
  // font/size/tracking can't be overridden. Only color (library / tone /
  // className) goes through twMerge, which handles standard color utilities
  // cleanly. This also sidesteps twMerge dropping the custom `text-ds-*` size
  // when a caller passes a text color.
  return (
    <p
      className={`inline-flex items-center gap-2 font-ds-mono text-ds-mono-caps uppercase ${twMerge(
        color,
        className,
      )}`}
    >
      {icon}
      {children}
    </p>
  )
}

/* -------------------------------------------------------------- FormInput -- */

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  focusRing?: 'blue' | 'orange' | 'purple'
}

const ringStyles: Record<NonNullable<FormInputProps['focusRing']>, string> = {
  blue: 'focus:border-border-focus focus:ring-border-focus/40',
  orange: 'focus:border-accent-warm focus:ring-accent-warm/40',
  purple: 'focus:border-accent-creative focus:ring-accent-creative/40',
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ className, focusRing = 'blue', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={twMerge(
          'w-full rounded-lg border border-border-default bg-background-surface px-3 py-2 text-text-primary placeholder-text-muted transition focus:outline-none focus:ring-2',
          ringStyles[focusRing],
          className,
        )}
        {...props}
      />
    )
  },
)

/* ------------------------------------------------------------------- Card -- */

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'rounded-lg border border-border-default bg-background-surface shadow-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------- InlineCode -- */

export function InlineCode({
  className,
  ...rest
}: React.HTMLProps<HTMLElement>) {
  return (
    <span
      className={twMerge(
        'rounded border border-border-default bg-background-subtle px-1 py-0.5 font-ds-mono text-[0.9em] text-text-primary',
        className,
      )}
      {...rest}
    />
  )
}

/* ---------------------------------------------------------------- Spinner -- */

export function Spinner({ className }: { className?: string }) {
  return (
    <CircleNotch
      className={twMerge('h-6 w-6 animate-spin text-text-primary', className)}
      aria-label="Loading"
    />
  )
}

/* ----------------------------------------------------------------- Avatar -- */

type AvatarSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const avatarSizeClasses: Record<
  AvatarSize,
  { container: string; text: string }
> = {
  '2xs': { container: 'w-4 h-4', text: 'text-[8px]' },
  xs: { container: 'w-6 h-6', text: 'text-xs' },
  sm: { container: 'w-8 h-8', text: 'text-sm' },
  md: { container: 'w-10 h-10', text: 'text-base' },
  lg: { container: 'w-14 h-14', text: 'text-lg' },
  xl: { container: 'w-20 h-20', text: 'text-xl' },
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return ''
}

export function Avatar({
  image,
  oauthImage,
  name,
  email,
  size = 'md',
  className = '',
}: {
  image?: string | null
  oauthImage?: string | null
  name?: string | null
  email?: string | null
  size?: AvatarSize
  className?: string
}) {
  const displayImage = image || oauthImage
  const initials = getInitials(name, email)
  const { container, text } = avatarSizeClasses[size]

  if (displayImage) {
    return (
      <img
        src={displayImage}
        alt={name || email || 'User avatar'}
        className={twMerge(container, 'rounded-full object-cover', className)}
      />
    )
  }

  return (
    <div
      className={twMerge(
        container,
        text,
        'flex items-center justify-center rounded-full bg-background-subtle font-medium text-text-secondary',
        className,
      )}
    >
      {initials || <User className="h-1/2 w-1/2 text-text-muted" />}
    </div>
  )
}

/* --------------------------------------------------------------- Dropdown -- */

export function Dropdown({
  children,
  open,
  onOpenChange,
  modal = false,
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {children}
    </DropdownMenu.Root>
  )
}

export function DropdownTrigger({
  children,
  className,
  asChild = true,
}: {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}) {
  return (
    <DropdownMenu.Trigger asChild={asChild} className={className}>
      {children}
    </DropdownMenu.Trigger>
  )
}

export function DropdownContent({
  children,
  className,
  align = 'end',
  sideOffset = 6,
}: {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={twMerge(
          'z-[1200] min-w-48 rounded-lg border border-border-default bg-background-elevated p-1.5 shadow-lg',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function DropdownItem({
  children,
  className,
  onSelect,
  asChild,
}: {
  children: React.ReactNode
  className?: string
  onSelect?: () => void
  asChild?: boolean
}) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      onSelect={onSelect}
      className={twMerge(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary outline-none transition-colors hover:bg-background-subtle hover:text-text-primary focus:bg-background-subtle focus:text-text-primary',
        className,
      )}
    >
      {children}
    </DropdownMenu.Item>
  )
}

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <DropdownMenu.Separator
      className={twMerge('my-1 h-px bg-border-subtle', className)}
    />
  )
}

/* ------------------------------------------------------------ Breadcrumbs -- */

export function Breadcrumbs({
  section,
  sectionTo,
  headings,
  tocHiddenBreakpoint = 'lg',
}: {
  section: string
  sectionTo?: string
  headings?: Array<MarkdownHeading>
  tocHiddenBreakpoint?: 'md' | 'lg' | 'xl'
}) {
  const showTocToggle = headings && headings.length > 1
  const hiddenClass =
    tocHiddenBreakpoint === 'md'
      ? 'md:hidden'
      : tocHiddenBreakpoint === 'xl'
        ? 'xl:hidden'
        : 'lg:hidden'

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-text-muted">
      {sectionTo ? (
        <Link
          to={sectionTo}
          className="whitespace-nowrap transition-colors hover:text-text-primary"
        >
          {section}
        </Link>
      ) : (
        <span className="whitespace-nowrap">{section}</span>
      )}
      {showTocToggle ? (
        <Dropdown>
          <DropdownTrigger>
            <button
              className={twMerge(
                hiddenClass,
                'inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-text-muted transition-colors hover:text-text-primary',
              )}
            >
              <span>On this page</span>
              <CaretDown className="h-3.5 w-3.5" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="end" sideOffset={8} className={hiddenClass}>
            {headings.map((heading) => (
              <DropdownItem key={`breadcrumb-toc-${heading.id}`} asChild>
                <Link
                  to="."
                  hash={heading.id}
                  style={{
                    paddingLeft: `${(heading.level - 2) * 0.5 + 0.5}rem`,
                  }}
                  resetScroll={false}
                  hashScrollIntoView={{ behavior: 'smooth' }}
                >
                  <span dangerouslySetInnerHTML={{ __html: heading.text }} />
                </Link>
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      ) : null}
    </div>
  )
}

export { PalmSpinner } from './PalmSpinner'
