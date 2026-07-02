import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Check, CaretDown, Code, Copy } from '@phosphor-icons/react'
import { copyTextToClipboard } from '~/utils/browser-effects'

/**
 * Presentational building blocks for the Design System pages (`/ds`).
 *
 * These are intentionally generic so that adding a new section or component
 * demo is just a matter of composing `DsPage` > `DsSection` > `ComponentPreview`.
 * Previews follow the global site theme (toggle it from the navbar) so what you
 * see is exactly what ships.
 */

export function DsPage({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <header className="mb-10">
        <h1 className="font-ds-display text-ds-display-sm text-text-primary">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-ds-body-md text-text-secondary">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-12">{children}</div>
    </div>
  )
}

export function DsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-ds-display text-ds-heading-4 text-text-primary">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-ds-body-sm text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/**
 * A live preview surface with an optional, copyable code snippet — the
 * copy-paste ("registry") mechanism for Phase 1. Each demo shows the rendered
 * component on a contrasting surface and lets maintainers grab the source.
 */
export function ComponentPreview({
  title,
  description,
  code,
  children,
  className,
}: {
  title?: string
  description?: string
  code?: string
  children: React.ReactNode
  className?: string
}) {
  const [showCode, setShowCode] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    if (!code) return
    await copyTextToClipboard(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [code])

  const hasHeader = Boolean(title || description || code)

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {hasHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-2.5">
          <div className="min-w-0">
            {title ? (
              <div className="truncate font-ds-display text-ds-heading-5 text-text-primary">
                {title}
              </div>
            ) : null}
            {description ? (
              <div className="truncate text-ds-body-sm text-text-muted">
                {description}
              </div>
            ) : null}
          </div>
          {code ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setShowCode((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-background-subtle hover:text-text-primary"
              >
                <Code className="h-3.5 w-3.5" />
                Code
                <CaretDown
                  className={twMerge(
                    'h-3.5 w-3.5 transition-transform',
                    showCode && 'rotate-180',
                  )}
                />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy code"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-background-subtle hover:text-text-primary"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={twMerge(
          'flex flex-wrap items-center gap-4 bg-background-subtle p-8',
          className,
        )}
      >
        {children}
      </div>

      {code && showCode ? (
        <pre className="overflow-x-auto border-t border-border-default bg-background-default p-4 font-ds-mono text-xs leading-relaxed text-text-secondary!">
          <code>{code}</code>
        </pre>
      ) : null}
    </div>
  )
}

/** A small labeled chunk inside a preview, e.g. to caption a row of variants. */
export function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-ds-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
      {children}
    </span>
  )
}

/**
 * A color swatch driven entirely by a CSS custom property token (e.g.
 * `twine-500` → `var(--color-twine-500)`). The hex label is read from the live
 * computed value so swatches never drift from `@theme` in app.css. Clicking
 * copies the CSS variable reference.
 */
function rgbToHex(value: string): string {
  const match = value.match(/rgba?\(([^)]+)\)/)
  if (!match) return value
  const parts = match[1].split(',').map((p) => p.trim())
  const [r, g, b] = parts
  const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function Swatch({ token }: { token: string }) {
  const [hex, setHex] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const swatchRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!swatchRef.current) return
    // Read the *computed* background so var()-referencing semantic tokens
    // resolve to a real color, not the literal "var(--…)" declaration.
    const resolved = getComputedStyle(swatchRef.current).backgroundColor
    setHex(rgbToHex(resolved))
  }, [token])

  const handleCopy = React.useCallback(async () => {
    await copyTextToClipboard(`var(--color-${token})`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [token])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group block text-left"
      title={`Copy var(--color-${token})`}
    >
      <div
        ref={swatchRef}
        className="h-16 w-full rounded-lg border border-black/5 shadow-inset dark:border-white/10"
        style={{ background: `var(--color-${token})` }}
      />
      <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-text-primary">
        {token}
        {copied ? (
          <Check className="h-3 w-3 text-status-success" />
        ) : (
          <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
        )}
      </div>
      <div className="font-ds-mono text-[11px] uppercase text-text-muted">
        {hex || '—'}
      </div>
    </button>
  )
}
