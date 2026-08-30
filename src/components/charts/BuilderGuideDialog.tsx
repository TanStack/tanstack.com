import { Dialog } from '@base-ui/react/dialog'
import { ArrowSquareOutIcon, XIcon } from '@phosphor-icons/react'
import type * as React from 'react'
import { Button } from '~/components/ds/ui'
import {
  builderEnvironmentRules,
  builderImportAliases,
  builderModuleRules,
  builderStarterSource,
  builderThemeRules,
  builderTips,
} from '~/utils/builder-environment'

export function BuilderGuideDialog({
  children,
}: {
  children: React.ReactElement
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={children} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Popup className="fixed inset-3 z-[1000] flex flex-col overflow-hidden rounded-xl border border-border-default bg-background-surface text-text-primary shadow-2xl outline-none sm:top-3 sm:right-3 sm:bottom-3 sm:left-auto sm:w-full sm:max-w-2xl">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default px-4">
            <Dialog.Title className="text-sm font-semibold">
              Builder guide
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <Button
                as="a"
                href="/builder/llms.txt"
                target="_blank"
                rel="noreferrer"
                variant="ghost"
                size="xs"
              >
                Plain text
                <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
              </Button>
              <Dialog.Close
                render={
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-sm"
                    color="gray"
                    aria-label="Close builder guide"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </div>
          </header>

          <Dialog.Description className="sr-only">
            TypeScript and JSX module rules, available imports, browser
            environment, sharing protocol, and authoring tips.
          </Dialog.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <GuideSection title="Module contract">
              <RuleList rules={builderModuleRules} />
            </GuideSection>

            <GuideSection title="Starter TSX">
              <pre className="overflow-x-auto rounded-lg border border-border-default bg-background-inverse p-4 text-xs/6 text-text-inverse">
                <code className="text-text-inverse">
                  {builderStarterSource}
                </code>
              </pre>
            </GuideSection>

            <GuideSection title="Import aliases">
              <div className="divide-y divide-border-default border-y border-border-default">
                {builderImportAliases.map(({ specifier, description }) => (
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
              <RuleList rules={builderEnvironmentRules} />
            </GuideSection>

            <GuideSection title="Theme">
              <RuleList rules={builderThemeRules} />
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
              <RuleList rules={builderTips} />
            </GuideSection>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
