import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import type * as React from 'react'
import { Button } from '~/components/ds/ui'
import {
  notebookEnvironmentRules,
  notebookImportAliases,
  notebookModuleRules,
  notebookStarterSource,
  notebookThemeRules,
  notebookTips,
} from '~/utils/notebook-environment'

export function NotebookGuideDialog({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-3 z-[1000] flex flex-col overflow-hidden rounded-xl border border-border-default bg-background-surface text-text-primary shadow-2xl outline-none duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:w-full sm:max-w-2xl sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-4">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Notebook guide
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              <Button
                as="a"
                href="/notebook/llms.txt"
                target="_blank"
                rel="noreferrer"
                variant="ghost"
                size="xs"
              >
                Plain text
                <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="icon"
                  size="icon-sm"
                  color="gray"
                  aria-label="Close notebook guide"
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </header>

          <DialogPrimitive.Description className="sr-only">
            TypeScript and JSX module rules, available imports, browser
            environment, sharing protocol, and authoring tips.
          </DialogPrimitive.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <GuideSection title="Module contract">
              <RuleList rules={notebookModuleRules} />
            </GuideSection>

            <GuideSection title="Starter TSX">
              <pre className="overflow-x-auto rounded-lg border border-border-default bg-background-inverse p-4 text-xs/6 text-text-inverse">
                <code className="text-text-inverse">
                  {notebookStarterSource}
                </code>
              </pre>
            </GuideSection>

            <GuideSection title="Import aliases">
              <div className="divide-y divide-border-default border-y border-border-default">
                {notebookImportAliases.map(({ specifier, description }) => (
                  <div
                    key={specifier}
                    className="grid gap-1 py-2.5 text-xs sm:grid-cols-[minmax(190px,auto)_1fr] sm:gap-4"
                  >
                    <code className="font-medium text-text-primary">
                      {specifier}
                    </code>
                    <span className="text-text-muted">{description}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs/5 text-text-muted">
                Full HTTPS ESM URLs are also supported.
              </p>
            </GuideSection>

            <GuideSection title="Browser environment">
              <RuleList rules={notebookEnvironmentRules} />
            </GuideSection>

            <GuideSection title="Theme">
              <RuleList rules={notebookThemeRules} />
            </GuideSection>

            <GuideSection title="Sharing">
              <p className="text-xs/5 text-text-muted">
                Source is UTF-8 encoded, gzipped, then base64url encoded into{' '}
                <code className="text-text-primary">#code=</code>. Title and
                description use search parameters. The editor keeps the URL
                current automatically.
              </p>
            </GuideSection>

            <GuideSection title="Tips">
              <RuleList rules={notebookTips} />
            </GuideSection>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function GuideSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}

function RuleList({ rules }: { rules: ReadonlyArray<string> }) {
  return (
    <ul className="space-y-2 text-xs/5 text-text-muted">
      {rules.map((rule) => (
        <li key={rule} className="flex gap-2.5">
          <span
            className="mt-[9px] size-1 shrink-0 rounded-full bg-text-muted"
            aria-hidden="true"
          />
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  )
}
