import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link } from '@tanstack/react-router'
import { CaretDownIcon } from '@phosphor-icons/react/CaretDown'
import { CircleNotchIcon } from '@phosphor-icons/react/CircleNotch'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/MagnifyingGlass'
import { UserIcon } from '@phosphor-icons/react/User'
import { XIcon } from '@phosphor-icons/react/X'
import type { MarkdownHeading } from '~/utils/markdown'
import type { LibraryId } from '~/libraries/ids'
import type { LibraryCategory } from '~/libraries/categories'

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

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'icon'
  | 'link'
  | 'subtle-link'
  | 'gradient'
type ButtonColor =
  | 'neutral'
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
type ButtonRounded = 'none' | 'md' | 'lg' | 'xl' | 'full'

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
// `neutral` is the default: a high-contrast mark that flips with the theme —
// near-black on light, white on dark — via the inverse semantic tokens.
const primaryColorStyles: Record<ButtonColor, string> = {
  neutral:
    'bg-background-inverse text-text-inverse border-background-inverse hover:bg-background-inverse/90 max-[899px]:bg-background-inverse/90',
  blue: 'bg-ds-blue-500 text-white border-ds-blue-500 hover:bg-ds-blue-400 max-[899px]:bg-ds-blue-400',
  green:
    'bg-ds-green-400 text-white border-ds-green-400 hover:bg-ds-green-300 max-[899px]:bg-ds-green-300',
  red: 'bg-ds-terracotta-400 text-white border-ds-terracotta-400 hover:bg-ds-terracotta-300 max-[899px]:bg-ds-terracotta-300',
  orange:
    'bg-ds-terracotta-300 text-white border-ds-terracotta-300 hover:bg-ds-terracotta-200 max-[899px]:bg-ds-terracotta-200',
  purple:
    'bg-ds-purple-400 text-white border-ds-purple-400 hover:bg-ds-purple-300 max-[899px]:bg-ds-purple-300',
  gray: 'bg-ds-neutral-400 text-white border-ds-neutral-400 hover:bg-ds-neutral-300 max-[899px]:bg-ds-neutral-300',
  emerald:
    'bg-ds-green-400 text-white border-ds-green-400 hover:bg-ds-green-300 max-[899px]:bg-ds-green-300',
  cyan: 'bg-lib-start text-white border-lib-start hover:bg-lib-start/90 max-[899px]:bg-lib-start/90',
  yellow:
    'bg-ds-amber-300 text-ds-neutral-500 border-ds-amber-300 hover:bg-ds-amber-200 max-[899px]:bg-ds-amber-200',
}

const iconColorStyles: Record<ButtonColor, string> = {
  neutral:
    'text-text-primary hover:bg-surface-state-hover max-[899px]:bg-surface-state-hover',
  blue: 'text-ds-blue-500 hover:bg-ds-blue-500/10 max-[899px]:bg-ds-blue-500/10',
  green:
    'text-ds-green-400 hover:bg-ds-green-400/10 max-[899px]:bg-ds-green-400/10',
  red: 'text-ds-terracotta-400 hover:bg-ds-terracotta-400/10 max-[899px]:bg-ds-terracotta-400/10',
  orange:
    'text-ds-terracotta-300 hover:bg-ds-terracotta-300/10 max-[899px]:bg-ds-terracotta-300/10',
  purple:
    'text-ds-purple-400 hover:bg-ds-purple-400/10 max-[899px]:bg-ds-purple-400/10',
  gray: 'text-text-muted hover:bg-surface-state-hover max-[899px]:bg-surface-state-hover max-[899px]:text-text-primary',
  emerald:
    'text-ds-green-400 hover:bg-ds-green-400/10 max-[899px]:bg-ds-green-400/10',
  cyan: 'text-lib-start hover:bg-lib-start/10 max-[899px]:bg-lib-start/10',
  yellow:
    'text-ds-amber-400 hover:bg-ds-amber-400/10 max-[899px]:bg-ds-amber-400/10',
}

const linkColorStyles: Record<ButtonColor, string> = {
  neutral:
    'text-text-primary hover:text-text-primary/70 max-[899px]:text-text-primary/70',
  blue: 'text-ds-blue-500 hover:text-ds-blue-400 max-[899px]:text-ds-blue-400',
  green:
    'text-ds-green-400 hover:text-ds-green-300 max-[899px]:text-ds-green-300',
  red: 'text-ds-terracotta-400 hover:text-ds-terracotta-300 max-[899px]:text-ds-terracotta-300',
  orange:
    'text-ds-terracotta-300 hover:text-ds-terracotta-200 max-[899px]:text-ds-terracotta-200',
  purple:
    'text-ds-purple-400 hover:text-ds-purple-300 max-[899px]:text-ds-purple-300',
  gray: 'text-text-secondary hover:text-text-primary max-[899px]:text-text-primary',
  emerald:
    'text-ds-green-400 hover:text-ds-green-300 max-[899px]:text-ds-green-300',
  cyan: 'text-lib-start hover:text-lib-start/80 max-[899px]:text-lib-start/80',
  yellow:
    'text-ds-amber-400 hover:text-ds-amber-300 max-[899px]:text-ds-amber-300',
}

// Gradient (landing-CTA) colors. Each color feeds the four --btn-grad-* vars
// the `gradient` variant paints with: accent → bright gradient, tint inner
// highlight, ink text, and a glow RGB triplet for the drop shadow. Sourced from
// the category role tokens (src/styles/app.css) so this stays the single place
// to manage the landing primary-CTA styling; purple has no category, so it maps
// straight to the ds-purple ramp.
const gradientColorStyles: Record<ButtonColor, string> = {
  neutral:
    '[--btn-grad-accent:var(--color-category-tooling-accent)] [--btn-grad-bright:var(--color-category-tooling-bright)] [--btn-grad-tint:var(--color-category-tooling-tint)] [--btn-grad-ink:var(--color-category-tooling-ink)] [--btn-grad-glow:var(--color-category-tooling-glow)]',
  blue: '[--btn-grad-accent:var(--color-category-ui-accent)] [--btn-grad-bright:var(--color-category-ui-bright)] [--btn-grad-tint:var(--color-category-ui-tint)] [--btn-grad-ink:var(--color-category-ui-ink)] [--btn-grad-glow:var(--color-category-ui-glow)]',
  green:
    '[--btn-grad-accent:var(--color-category-framework-accent)] [--btn-grad-bright:var(--color-category-framework-bright)] [--btn-grad-tint:var(--color-category-framework-tint)] [--btn-grad-ink:var(--color-category-framework-ink)] [--btn-grad-glow:var(--color-category-framework-glow)]',
  red: '[--btn-grad-accent:var(--color-category-data-accent)] [--btn-grad-bright:var(--color-category-data-bright)] [--btn-grad-tint:var(--color-category-data-tint)] [--btn-grad-ink:var(--color-category-data-ink)] [--btn-grad-glow:var(--color-category-data-glow)]',
  orange:
    '[--btn-grad-accent:var(--color-category-performance-accent)] [--btn-grad-bright:var(--color-category-performance-bright)] [--btn-grad-tint:var(--color-category-performance-tint)] [--btn-grad-ink:var(--color-category-performance-ink)] [--btn-grad-glow:var(--color-category-performance-glow)]',
  purple:
    '[--btn-grad-accent:var(--color-ds-purple-400)] [--btn-grad-bright:var(--color-ds-purple-300)] [--btn-grad-tint:var(--color-ds-purple-100)] [--btn-grad-ink:#ffffff] [--btn-grad-glow:175_87_188]',
  gray: '[--btn-grad-accent:var(--color-category-tooling-accent)] [--btn-grad-bright:var(--color-category-tooling-bright)] [--btn-grad-tint:var(--color-category-tooling-tint)] [--btn-grad-ink:var(--color-category-tooling-ink)] [--btn-grad-glow:var(--color-category-tooling-glow)]',
  emerald:
    '[--btn-grad-accent:var(--color-category-framework-accent)] [--btn-grad-bright:var(--color-category-framework-bright)] [--btn-grad-tint:var(--color-category-framework-tint)] [--btn-grad-ink:var(--color-category-framework-ink)] [--btn-grad-glow:var(--color-category-framework-glow)]',
  cyan: '[--btn-grad-accent:var(--color-category-ui-accent)] [--btn-grad-bright:var(--color-category-ui-bright)] [--btn-grad-tint:var(--color-category-ui-tint)] [--btn-grad-ink:var(--color-category-ui-ink)] [--btn-grad-glow:var(--color-category-ui-glow)]',
  yellow:
    '[--btn-grad-accent:var(--color-category-performance-accent)] [--btn-grad-bright:var(--color-category-performance-bright)] [--btn-grad-tint:var(--color-category-performance-tint)] [--btn-grad-ink:var(--color-category-performance-ink)] [--btn-grad-glow:var(--color-category-performance-glow)]',
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.18)] hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.25)] max-[899px]:-translate-y-px max-[899px]:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.25)] active:translate-y-0 active:shadow-[0_1px_2px_0_rgba(0,0,0,0.12)]',
  secondary:
    'bg-action-secondary text-text-primary hover:bg-action-secondary-hover max-[899px]:bg-action-secondary-hover border-transparent font-medium shadow-sm hover:-translate-y-px hover:shadow-md max-[899px]:-translate-y-px max-[899px]:shadow-md active:translate-y-0',
  ghost:
    'border border-border-default text-text-primary hover:bg-background-subtle hover:border-border-strong max-[899px]:bg-background-subtle max-[899px]:border-border-strong font-medium hover:shadow-sm max-[899px]:shadow-sm',
  icon: 'border-transparent active:scale-90',
  link: 'border-transparent font-medium underline-offset-2 hover:underline max-[899px]:underline',
  'subtle-link':
    'border-transparent font-ds-mono uppercase tracking-wider no-underline hover:no-underline [&>svg:last-child]:size-3.5 [&>svg:last-child]:transition-transform hover:[&>svg:last-child]:translate-x-0.5 max-[899px]:[&>svg:last-child]:translate-x-0.5 motion-reduce:[&>svg:last-child]:transition-none',
  // Library-landing primary CTA: accent→bright gradient with an inner highlight,
  // a colored glow, ink text, and a hover lift. Colors come from
  // gradientColorStyles (the --btn-grad-* vars).
  gradient:
    'border-transparent font-medium text-[var(--btn-grad-ink)] [background-image:linear-gradient(105deg,var(--btn-grad-accent),var(--btn-grad-bright))] shadow-[inset_-5px_-5px_7px_-5px_var(--btn-grad-tint),0_12px_35px_-6px_rgb(var(--btn-grad-glow)/0.35)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[inset_-5px_-5px_7px_-5px_var(--btn-grad-tint),0_18px_45px_-6px_rgb(var(--btn-grad-glow)/0.5)] max-[899px]:-translate-y-0.5 max-[899px]:shadow-[inset_-5px_-5px_7px_-5px_var(--btn-grad-tint),0_18px_45px_-6px_rgb(var(--btn-grad-glow)/0.5)] active:translate-y-0 focus-visible:ring-[var(--btn-grad-bright)]',
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
  xl: 'rounded-xl',
  full: 'rounded-full',
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background-default'

function getDefaultSize(variant: ButtonVariant): ButtonSize {
  if (variant === 'icon') return 'icon-md'
  if (variant === 'gradient') return 'lg'
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
    color = 'neutral',
    size,
    rounded,
    className,
    ...rest
  } = props as ButtonOwnProps & Record<string, unknown>
  const Component = as || 'button'
  const resolvedSize = size ?? getDefaultSize(variant)
  const resolvedRounded =
    rounded ?? (variant === 'gradient' ? 'xl' : getDefaultRounded(resolvedSize))
  const colorStyles =
    variant === 'primary'
      ? primaryColorStyles[color]
      : variant === 'icon'
        ? iconColorStyles[color]
        : variant === 'link' || variant === 'subtle-link'
          ? linkColorStyles[color]
          : variant === 'gradient'
            ? gradientColorStyles[color]
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
type BadgeRounded = 'md' | 'full'

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
  rounded = 'full',
  className,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  rounded?: BadgeRounded
  className?: string
}) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center px-2 py-1 text-xs font-medium',
        rounded === 'full' ? 'rounded-full' : 'rounded-md',
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
// Category brand colors (--color-category-*). Written as literal classes so
// Tailwind's JIT emits each `text-category-*` utility.
const eyebrowCategoryStyles: Record<LibraryCategory, string> = {
  framework: 'text-category-framework',
  data: 'text-category-data',
  ui: 'text-category-ui',
  performance: 'text-category-performance',
  tooling: 'text-category-tooling',
}

const eyebrowLibraryStyles: Partial<Record<LibraryId, string>> = {
  start: 'text-lib-start',
  router: 'text-lib-router',
  query: 'text-lib-query',
  table: 'text-lib-table',
  charts: 'text-lib-charts',
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
 * Color resolves in priority order: `category` (brand by category, via the
 * `--color-category-*` token) → `library` (brand by a specific library's
 * `--color-lib-*` token) → `className` override → `tone` (neutral default). Pass
 * a `category`/`library` to brand it, omit both for a neutral eyebrow.
 */
export function Eyebrow({
  children,
  icon,
  tone = 'secondary',
  category,
  library,
  className,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  tone?: EyebrowTone
  /** Brand the eyebrow by the library category it sits within. Takes priority
   *  over `library`; falls back to `tone` when unset. */
  category?: LibraryCategory
  /** Brand the eyebrow by the library it's nested within. Falls back to `tone`
   *  when unset or when the library has no brand token. */
  library?: LibraryId
  className?: string
}) {
  const color =
    (category && eyebrowCategoryStyles[category]) ??
    (library && eyebrowLibraryStyles[library]) ??
    eyebrowToneStyles[tone]

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

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  focusRing?: 'blue' | 'orange' | 'purple'
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect({ className, focusRing = 'blue', ...props }, ref) {
    return (
      <select
        ref={ref}
        className={twMerge(
          'w-full rounded-lg border border-border-default bg-background-surface px-3 py-2 text-text-primary transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
          ringStyles[focusRing],
          className,
        )}
        {...props}
      />
    )
  },
)

/* ------------------------------------------------------------- SearchInput -- */

type SearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type'
> & {
  size?: 'default' | 'large'
  progressive?: boolean
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { className, size = 'default', progressive = false, ...props },
    forwardedRef,
  ) {
    const [open, setOpen] = React.useState(!progressive)
    const [skipMotion, setSkipMotion] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)

    React.useImperativeHandle(forwardedRef, () => inputRef.current!)

    React.useEffect(() => {
      if (open && progressive) inputRef.current?.focus()
    }, [open, progressive])

    const reveal = (event: React.MouseEvent<HTMLButtonElement>) => {
      setSkipMotion(event.detail === 0)
      if (open) {
        inputRef.current?.focus()
      } else {
        setOpen(true)
      }
    }

    const close = (keyboardInitiated: boolean) => {
      setSkipMotion(keyboardInitiated)
      setOpen(false)
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }

    const input = (
      <input
        ref={inputRef}
        type="search"
        className={twMerge(
          'min-w-0 flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none [&::-webkit-search-cancel-button]:hidden',
          size === 'large' ? 'text-base' : 'text-sm',
          className,
        )}
        {...props}
        onKeyDown={(event) => {
          props.onKeyDown?.(event)
          if (progressive && event.key === 'Escape') close(true)
        }}
      />
    )

    if (!progressive) {
      return (
        <label
          className={twMerge(
            'flex w-full items-center border border-border-default bg-background-surface text-text-muted transition-[border-color,box-shadow] duration-150 focus-within:border-border-focus focus-within:text-text-primary focus-within:ring-2 focus-within:ring-border-focus/40 motion-reduce:transition-none',
            size === 'large'
              ? 'min-h-14 gap-3 rounded-xl px-4'
              : 'h-10 gap-2.5 rounded-lg px-3',
          )}
        >
          <MagnifyingGlassIcon
            size={size === 'large' ? 21 : 18}
            weight="bold"
            aria-hidden="true"
            className="shrink-0"
          />
          {input}
        </label>
      )
    }

    return (
      <div className="relative h-12 w-full max-w-72">
        <div className="absolute inset-0 flex items-start text-text-muted focus-within:text-text-primary">
          <button
            ref={triggerRef}
            type="button"
            aria-label={open ? 'Focus search' : 'Open search'}
            aria-expanded={open}
            onClick={reveal}
            className="grid size-10 shrink-0 place-items-center transition-colors duration-150 hover:text-text-primary focus-visible:text-text-accent focus-visible:outline-none motion-reduce:transition-none"
          >
            <MagnifyingGlassIcon size={18} weight="bold" aria-hidden="true" />
          </button>
          {React.cloneElement(input, {
            tabIndex: open ? props.tabIndex : -1,
            'aria-hidden': !open,
            className: twMerge(
              input.props.className,
              'h-12 pb-4 pt-2 transition-opacity ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
              open
                ? 'opacity-100 duration-[220ms]'
                : 'pointer-events-none opacity-0 duration-100',
              skipMotion && 'transition-none',
            ),
          })}
          <button
            type="button"
            aria-label="Close search"
            tabIndex={open ? 0 : -1}
            onClick={(event) => close(event.detail === 0)}
            className={twMerge(
              'grid size-10 shrink-0 place-items-center text-text-muted transition-opacity duration-100 hover:text-text-primary focus-visible:text-text-accent focus-visible:outline-none motion-reduce:transition-none',
              open ? 'opacity-100' : 'pointer-events-none opacity-0',
              skipMotion && 'transition-none',
            )}
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
          <span
            aria-hidden="true"
            className={twMerge(
              'pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-border-focus transition-transform ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
              open ? 'scale-x-100 duration-[240ms]' : 'scale-x-0 duration-100',
              skipMotion && 'transition-none',
            )}
          />
        </div>
      </div>
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
    <CircleNotchIcon
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
      {initials || <UserIcon className="h-1/2 w-1/2 text-text-muted" />}
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
              <CaretDownIcon className="h-3.5 w-3.5" />
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
export { PixelSpinner } from './PixelSpinner'
export {
  StatsSection,
  type StatsPage,
  type StatsLayout,
  type StatItem,
} from './StatsSection'
