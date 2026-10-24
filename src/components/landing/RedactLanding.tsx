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
      headline="Built for the React you love."
      description="We love React, and we want to keep writing it. Redact is an alternative runtime for React apps, with a smaller footprint and synchronous rendering. Keep your components, hooks, and imports, and try it with one Vite plugin."
      hero={
        <div className="min-w-0 space-y-5">
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
                smaller than React in our default-runtime benchmark
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
          <div className="space-y-5">
            <LandingSectionIntro
              title="Still writing React."
              body="React's component model is the reason we built this. Redact keeps that familiar way of building apps, including server rendering, Fast Refresh, and React DevTools, while exploring how small the runtime underneath it can be."
            />
            <p className="text-ds-body-sm leading-relaxed text-text-secondary">
              We trade concurrent scheduling for a smaller, synchronous runtime.
              Streaming SSR, hydration, and Suspense are still on board.
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
              API differences ↗
            </Link>
          </div>
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
            title="How small do you want to go?"
            body="Leave out class components if you don't use them, drop hydration if you're rendering everything on the client, or start with nano and build up from there. Every optional feature starts off, you choose what comes back."
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
          </div>
        </div>
      </LandingSection>
      <LandingSection tone="ink">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <LandingSectionIntro
            title="Keep your DevTools, too."
            body="Dig through your components and hooks, tweak props and state, and find out what's rendering with the React DevTools you already use."
          />
          <div className="space-y-5 text-ds-body-sm leading-relaxed text-text-secondary">
            <p>
              Debugging tools belong in development, so we leave them out of
              your production build. All of this adds zero bytes to what your
              users download.
            </p>
            <a
              href={`${repo}/blob/main/docs/devtools-implementation-status.md`}
              className="inline-block font-medium text-text-primary underline underline-offset-4"
            >
              React DevTools support ↗
            </a>
          </div>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}
