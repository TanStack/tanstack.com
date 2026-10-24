import { Link } from '@tanstack/react-router'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import {
  LandingSection,
  LandingSectionIntro,
  LibraryLandingShell,
} from './LibraryLanding'

const repo = 'https://github.com/TanStack/redact'

export default function RedactLanding() {
  return (
    <LibraryLandingShell
      libraryId="redact"
      headline="React, redacted."
      description="Keep your components, hooks, and React imports. Swap in a smaller runtime that renders synchronously, with one Vite plugin."
      hero={
        <div className="min-w-0 space-y-5">
          <div
            aria-label="React becomes Redact"
            className="font-ds-display text-ds-heading-1 font-bold tracking-tight"
          >
            <span className="text-text-muted line-through decoration-[0.1em]">
              React
            </span>{' '}
            Redact
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'performance',
              }}
              className="rounded-xl border border-border-subtle bg-background-surface p-5 transition-opacity hover:opacity-80 sm:p-6"
            >
              <span className="block font-ds-display text-4xl font-bold sm:text-5xl">
                66.3%
              </span>
              <span className="mt-2 block text-sm text-text-secondary">
                smaller default runtime than React
              </span>
            </Link>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'feature-flags',
              }}
              className="rounded-xl border border-border-subtle bg-background-surface p-5 transition-opacity hover:opacity-80 sm:p-6"
            >
              <span className="block font-ds-display text-4xl font-bold sm:text-5xl">
                12.5 <span className="text-xl">kB</span>
              </span>
              <span className="mt-2 block text-sm text-text-secondary">
                nano DOM client, gzipped
              </span>
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">
            Redact 0.1.0 measurements. Savings compare all client exports with
            React 19.3.0. Nano disables all optional features. App sizes vary.
          </p>
          <CodeBlock dataCodeTitle="vite.config.ts">
            <code className="language-ts">{`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  plugins: [react(), redact()],
})`}</code>
          </CodeBlock>
        </div>
      }
    >
      <LandingSection tone="accent">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <LandingSectionIntro
            title="One plugin. Same imports."
            body="Keep writing the React code you know. The Vite plugin handles React, React DOM, server rendering, scheduler, and JSX entrypoints for client and SSR builds."
          />
          <CodeBlock dataCodeTitle="Counter.tsx">
            <code className="language-tsx">{`import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}`}</code>
          </CodeBlock>
        </div>
      </LandingSection>
      <LandingSection tone="raised">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <LandingSectionIntro
            title="Only ship the parts you use."
            body="Start with the default preset, then leave out behavior your app doesn't need. Or start with nano and turn features on individually, with explicit control over hydration, context, portals, Suspense, and more."
          />
          <div className="min-w-0">
            <CodeBlock dataCodeTitle="Feature selection">
              <code className="language-ts">{`// A client-rendered app without class components
redact({
  features: { hydration: false, classComponents: false },
})

// All optional features off, then context enabled
redact({ preset: 'nano', features: { context: true } })`}</code>
            </CodeBlock>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Disabling features changes behavior. Nano is not a
              full-compatibility preset, and feature size savings are not
              additive.
            </p>
          </div>
        </div>
      </LandingSection>
      <LandingSection tone="ink">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <LandingSectionIntro
            title="Know what changes."
            body="Redact keeps the React component model without concurrent scheduling. Rendering and transitions run synchronously, pending stays false, and deferred values return their input. Actions and optimistic state have limited behavior."
          />
          <div className="space-y-5 text-ds-body-sm leading-relaxed text-text-secondary">
            <p>
              Streaming SSR, hydration, Suspense, and Fast Refresh are
              supported. Server Components stay on upstream React in the RSC
              environment.
            </p>
            <Link
              to="/$libraryId/$version/docs/$"
              params={{
                libraryId: 'redact',
                version: 'latest',
                _splat: 'compatibility',
              }}
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              Read the compatibility guide
            </Link>
            <p>
              Keep your React DevTools, too. Inspect components and hooks, edit
              props and state, and profile commits in development. DevTools adds
              zero bytes to production bundles. The public Profiler callback
              remains a no-op.
            </p>
            <a
              href={`${repo}/blob/main/docs/devtools-implementation-status.md`}
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              DevTools checks and timings ↗
            </a>
            <p>
              Performance depends on the workload. Published measurements
              include faster state updates and slower hydration and Suspense
              retries, they do not establish whole-app speedups.
            </p>
            <a
              href={`${repo}/blob/main/benchmarks/SHIP_MEASUREMENTS.md`}
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              Performance measurements ↗
            </a>
          </div>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}
