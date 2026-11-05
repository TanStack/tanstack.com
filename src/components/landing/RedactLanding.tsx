import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import bundleSizes from '~/data/redact-framework-sizes.json'
import { LandingSection, LibraryLandingShell } from './LibraryLanding'

const largestBundle = Math.max(
  ...bundleSizes.comparisons.flatMap((item) => [
    item.reactBytes,
    item.redactBytes,
  ]),
)
const kb = (bytes: number) => (bytes / 1000).toFixed(1)
const frameworkLogos = new Map([
  ['Start', '/favicon-light.svg'],
  ['Vite', '/images/frameworks/vite.svg'],
  ['Vinext', '/images/frameworks/vinext.ico'],
  ['Next.js', '/images/frameworks/next.ico'],
])
const setups = [
  {
    name: 'Start',
    file: 'vite.config.ts',
    guide: 'start',
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
                <figcaption className="mb-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <img
                      src={frameworkLogos.get(item.framework)}
                      alt=""
                      width={18}
                      height={18}
                      className="size-4.5 shrink-0 object-contain"
                    />
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
                <div className="space-y-2.5">
                  {[
                    {
                      name: 'React',
                      bytes: item.reactBytes,
                      leanBytes: null,
                      redact: false,
                    },
                    {
                      name: 'Redact',
                      bytes: item.redactBytes,
                      leanBytes: item.redactLeanBytes,
                      redact: true,
                    },
                  ].map((row) => (
                    <div key={row.name}>
                      <div aria-hidden="true" className="mb-1 text-xs">
                        {row.name}
                      </div>
                      <div className="pr-16">
                        <div
                          role="img"
                          aria-label={`${row.name}: ${row.leanBytes ? `${row.leanBytes.toLocaleString('en-US')} bytes with unused features disabled, ` : ''}${row.bytes.toLocaleString('en-US')} bytes by default, gzipped`}
                          title={`${row.leanBytes ? `${row.leanBytes.toLocaleString('en-US')} bytes with unused features disabled; ` : ''}${row.bytes.toLocaleString('en-US')} bytes by default. Labels round up to whole KB.`}
                          className={`relative h-4 rounded-sm ${row.redact ? (row.leanBytes ? 'bg-[color-mix(in_srgb,var(--landing-accent),white_55%)]' : 'bg-[var(--landing-accent)]') : 'bg-text-secondary/30'}`}
                          style={{
                            width: `${(row.bytes / largestBundle) * 100}%`,
                          }}
                        >
                          {row.leanBytes && (
                            <div
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 rounded-l-sm bg-[var(--landing-accent)]"
                              style={{
                                width: `${(row.leanBytes / row.bytes) * 100}%`,
                              }}
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className="absolute top-0 left-full ml-1.5 whitespace-nowrap font-mono text-[10px] leading-4 text-text-secondary tabular-nums"
                          >
                            {row.leanBytes &&
                              `${Math.ceil(row.leanBytes / 1000)}–`}
                            {Math.ceil(row.bytes / 1000)} KB
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </figure>
            ))}
          </div>
          <p className="mt-5 text-[10px] leading-relaxed text-text-secondary">
            Client JS + CSS, gzip. Pale green: optional features.{' '}
            <a
              href="https://github.com/TanStack/redact/tree/40fffcb7dd4cca1d2011dfecad995db260d6f809/benchmarks/framework-bundles"
              title="Versions, source, and measurements"
              className="whitespace-nowrap underline underline-offset-2"
            >
              Source ↗
            </a>
          </p>
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
              In Vinext and Next.js, the framework keeps server rendering,
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
              Start and Vite can go smaller still.
            </h2>
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              Leave out features your app and framework don't use, or start with
              nano and add them back. Vinext and Next.js use the full runtime so
              their framework features stay available.
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
              Choose your features ↗
            </Link>
          </div>
          <CodeBlock dataCodeTitle="vite.config.ts">
            <code className="language-ts">{`// Start: keep hydration and router features
redact({
  features: {
    activity: false,
    fragmentRefs: false,
    portal: false,
  },
})

// Vite: a client-only app without optional features
redact({ preset: 'nano' })`}</code>
          </CodeBlock>
        </div>
      </LandingSection>
      <LandingSection>
        <div className="max-w-3xl space-y-5">
          <h2 className="font-ds-display text-3xl font-bold tracking-tight sm:text-4xl">
            Why not Preact?
          </h2>
          <p className="text-ds-body-sm leading-relaxed text-text-secondary">
            Preact is smaller. Redact keeps more of the React behavior your app
            may rely on, like pending transitions, deferred results, and form
            actions. If keeping that behavior matters more than the smallest
            download, Redact is worth a look.
          </p>
          <Link
            to="/$libraryId/$version/docs/$"
            params={{
              libraryId: 'redact',
              version: 'latest',
              _splat: 'comparison',
            }}
            className="inline-block font-medium underline underline-offset-4"
          >
            Compare compatibility, size, and speed ↗
          </Link>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}
