import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import bundleSizes from '~/data/redact-framework-sizes.json'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'

const repo = 'https://github.com/TanStack/redact'
const largestBundle = Math.max(
  ...bundleSizes.comparisons.flatMap((item) => [
    item.reactBytes,
    item.redactBytes,
  ]),
)
const kb = (bytes: number) => (bytes / 1000).toFixed(1)
const setups = [
  {
    name: 'Next.js',
    file: 'next.config.mjs',
    guide: 'next',
    detail:
      'App Router and Pages Router, with Turbopack or Webpack. Keep React installed, it still runs your server.',
    code: `import { withRedact } from '@tanstack/redact/next'

export default withRedact({
  // Your existing Next.js options
})`,
  },
  {
    name: 'Vinext',
    file: 'vite.config.ts',
    guide: 'vinext',
    detail:
      'Add Redact after Vinext. Keep your Next.js imports, routes, and server React.',
    code: `import { defineConfig } from 'vite'
import vinext from 'vinext'
import { redact } from '@tanstack/redact/vinext'

export default defineConfig({
  plugins: [vinext(), redact()],
})`,
  },
  {
    name: 'Start',
    file: 'vite.config.ts',
    guide: 'vite-plugin',
    detail:
      'Add Redact after Start and React. Bundle server dependencies so their React imports use the same runtime as your app.',
    code: `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  ssr: { noExternal: true },
  plugins: [tanstackStart(), react(), redact()],
})`,
  },
  {
    name: 'Vite',
    file: 'vite.config.ts',
    guide: 'vite-plugin',
    detail:
      'Keep your React or framework plugin. The Vite integration handles client and SSR builds, with optional features you can leave out.',
    code: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  plugins: [react(), redact()],
})`,
  },
]

export default function RedactLanding() {
  const [selected, setSelected] = useState(0)
  const setup = setups[selected]

  return (
    <LibraryLandingShell
      libraryId="redact"
      headline="For the love of React, and smaller bundles."
      description="Keep the components, hooks, and imports you love. Redact is a smaller, synchronous runtime for React apps, with integrations for TanStack Start, Vite, Vinext, and Next.js."
      hero={
        <section
          id="bundle-sizes"
          aria-label="Client bundle size comparisons"
          className="min-w-0 rounded-2xl border border-border-subtle bg-background-surface p-6 sm:p-8"
        >
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {bundleSizes.comparisons.map((item) => (
              <figure key={item.framework}>
                <figcaption className="mb-4">
                  <h2 className="text-lg font-semibold">
                    {item.framework === 'Start'
                      ? 'TanStack Start'
                      : item.framework}
                  </h2>
                  <p className="mt-1 font-ds-display text-2xl font-bold tabular-nums">
                    {kb(item.reactBytes - item.redactBytes)} KB less
                  </p>
                  <p className="mt-1 text-sm text-text-secondary tabular-nums">
                    {((1 - item.redactBytes / item.reactBytes) * 100).toFixed(
                      1,
                    )}
                    % smaller
                  </p>
                </figcaption>
                <div className="space-y-3">
                  {[
                    { name: 'React', bytes: item.reactBytes, redact: false },
                    { name: 'Redact', bytes: item.redactBytes, redact: true },
                  ].map((row) => (
                    <div key={row.name}>
                      <div className="mb-1.5 flex justify-between gap-3 text-sm">
                        <span>{row.name}</span>
                        <span className="font-mono tabular-nums">
                          {kb(row.bytes)} KB
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className={`h-5 rounded-sm ${row.redact ? 'bg-[var(--landing-accent)]' : 'bg-text-secondary/30'}`}
                        style={{
                          width: `${(row.bytes / largestBundle) * 100}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </figure>
            ))}
          </div>
          <div className="mt-7 space-y-3 border-t border-border-subtle pt-5 text-sm leading-relaxed text-text-secondary">
            <p>
              Same counter app, production client JS + CSS, gzipped. Includes
              every emitted chunk. Shared scale, 1 KB = 1,000 bytes.
            </p>
            <a
              href="https://github.com/TanStack/tanstack.com/tree/main/launch/benchmarks/redact-frameworks"
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              Versions, source, and measurements ↗
            </a>
          </div>
        </section>
      }
    >
      <LandingSection tone="accent">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
              Bring your framework.
            </h2>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Framework setup"
            >
              {setups.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={selected === index}
                  aria-controls="redact-framework-setup"
                  onClick={() => setSelected(index)}
                  className={`rounded-lg border px-4 py-2.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${selected === index ? 'border-text-primary bg-text-primary text-background-default' : 'border-border-subtle bg-background-surface hover:border-text-secondary'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <p className="max-w-lg text-ds-body-sm leading-relaxed text-text-secondary">
              {setup.detail}
            </p>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: setup.guide,
              }}
              className="inline-block font-medium underline underline-offset-4"
            >
              {setup.name} setup and coverage ↗
            </Link>
            {(setup.name === 'Next.js' || setup.name === 'Vinext') && (
              <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
                The Next.js and Vinext release isn't published yet.{' '}
                <a
                  href={`${repo}/pull/52`}
                  className="underline underline-offset-4"
                >
                  Track the release
                </a>
                .
              </p>
            )}
          </div>
          <div id="redact-framework-setup" className="min-w-0">
            <CodeBlock dataCodeTitle={setup.file}>
              <code className="language-ts">{setup.code}</code>
            </CodeBlock>
          </div>
        </div>
      </LandingSection>
      <LandingSection tone="raised">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
              Server Components stay with React.
            </h2>
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              In Next.js and Vinext, the framework keeps server rendering,
              Server Components, caching, and action transport. Redact picks up
              in the browser, hydrates the HTML, and runs your client
              components.
            </p>
            <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="rounded-lg border border-border-subtle px-4 py-3">
                <span className="block text-text-secondary">Server</span>
                <strong className="text-lg">React</strong>
              </div>
              <span className="text-text-secondary">HTML + Flight →</span>
              <div className="rounded-lg border border-border-subtle px-4 py-3">
                <span className="block text-text-secondary">Browser</span>
                <strong className="text-lg">Redact</strong>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
              Smaller comes with a choice.
            </h2>
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              Redact renders synchronously, without React's time slicing or
              interruptible component renders. Suspended transitions can keep
              the current screen visible, actions can show pending and
              optimistic state, and streamed content can still arrive as it's
              ready.
            </p>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'compatibility',
              }}
              className="inline-block font-medium underline underline-offset-4"
            >
              Rendering and API differences ↗
            </Link>
          </div>
        </div>
      </LandingSection>
      <LandingSection>
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
              More than a counter demo.
            </h2>
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              The compatibility suite runs real browser journeys in Chromium,
              Firefox, and WebKit. Both App Router and Pages Router are in the
              matrix, including apps that only use Pages Router.
            </p>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'verification',
              }}
              className="inline-block font-medium underline underline-offset-4"
            >
              Test matrix and recorded results ↗
            </Link>
          </div>
          <ul className="divide-y divide-border-subtle text-ds-body-sm leading-relaxed">
            <li className="pb-5">
              <strong className="block">
                Navigate without losing your place.
              </strong>
              <span className="text-text-secondary">
                Retained layouts, back and forward, shallow routing, redirects,
                and canceled navigation.
              </span>
            </li>
            <li className="py-5">
              <strong className="block">Submit, wait, and recover.</strong>
              <span className="text-text-secondary">
                Server Actions, pending forms, optimistic updates, uploads, and
                error boundaries.
              </span>
            </li>
            <li className="pt-5">
              <strong className="block">
                Pick up where the server left off.
              </strong>
              <span className="text-text-secondary">
                Hydration, streamed Suspense, Cache Components, and Fast Refresh
                that keeps state through an edit.
              </span>
            </li>
          </ul>
        </div>
      </LandingSection>
      <LandingSection tone="ink">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
              Vite apps can go smaller still.
            </h2>
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              Leave out features your app doesn't use, or start with nano and
              add them back. Next.js and Vinext use the full runtime so their
              framework features stay available.
            </p>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'feature-flags',
              }}
              className="inline-block font-medium underline underline-offset-4"
            >
              Choose your Vite features ↗
            </Link>
          </div>
          <CodeBlock dataCodeTitle="vite.config.ts">
            <code className="language-ts">{`// A client-rendered app without class components
redact({
  features: { hydration: false, classComponents: false },
})

// All optional features off, then context enabled
redact({ preset: 'nano', features: { context: true } })`}</code>
          </CodeBlock>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}
