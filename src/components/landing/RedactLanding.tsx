import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'

const repo = 'https://github.com/TanStack/redact'
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
      description="Keep the components, hooks, and imports you love. Redact is a smaller, synchronous runtime for React apps, with integrations for Vite, Next.js, and Vinext."
      hero={
        <figure className="min-w-0 rounded-2xl border border-border-subtle bg-background-surface p-6 sm:p-9">
          <div className="font-ds-display text-5xl font-bold tracking-tight sm:text-6xl">
            39.4 <span className="text-3xl">KB less.</span>
          </div>
          <p className="mt-3 text-ds-body-sm text-text-secondary">
            Client output in Vinext's benchmark, gzipped.
          </p>
          <div className="my-8 space-y-5">
            {[
              {
                name: 'Vinext + React',
                size: '154.9 KB',
                width: '100%',
                redact: false,
              },
              {
                name: 'Vinext + Redact',
                size: '115.5 KB',
                width: '74.6%',
                redact: true,
              },
            ].map((row) => (
              <div key={row.name}>
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <span>{row.name}</span>
                  <span className="font-mono tabular-nums">{row.size}</span>
                </div>
                <div
                  aria-hidden="true"
                  className={`h-8 rounded-sm ${row.redact ? 'bg-[var(--landing-accent)]' : 'bg-text-secondary/25'}`}
                  style={{ width: row.width }}
                />
              </div>
            ))}
          </div>
          <figcaption className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>
              25.4% smaller across six builds of the same app. Includes all
              emitted client JS and CSS, including lazy routes.
            </p>
            <a
              href={`${repo}/blob/main/benchmarks/VINEXT_BENCHMARKS.md`}
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              Measurements and timing tradeoffs ↗
            </a>
          </figcaption>
        </figure>
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
            <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
              The Next.js and Vinext release is waiting on upstream fixes.{' '}
              <a
                href={`${repo}/pull/52`}
                className="underline underline-offset-4"
              >
                Track the release
              </a>
              .
            </p>
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
