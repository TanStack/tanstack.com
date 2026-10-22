import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { seo } from '~/utils/seo'

const repo = 'https://github.com/TanStack/redact'
const description =
  'A smaller React-compatible runtime with synchronous rendering. Install TanStack Redact, keep your React imports, and choose the features your app needs.'

export const Route = createFileRoute('/redact')({
  head: () => ({
    meta: seo({ title: 'TanStack Redact | React, redacted.', description }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          name: 'TanStack Redact',
          description,
          url: 'https://tanstack.com/redact',
          codeRepository: repo,
          programmingLanguage: 'TypeScript',
          runtimePlatform: 'JavaScript',
        }),
      },
    ],
  }),
  component: RedactPage,
})

const sections = [
  ['install', 'Install'],
  ['size', 'Bundle size'],
  ['compatibility', 'Compatibility'],
  ['features', 'Feature flags'],
  ['reference', 'Plugin reference'],
  ['verification', 'Before you ship'],
]

const compatibility = [
  [
    'Components and hooks',
    'JSX, state, effects, context, refs, memo, lazy, portals, error boundaries, and modern class lifecycles are supported. Legacy class lifecycles are no-ops.',
  ],
  [
    'Suspense and hydration',
    'Fallbacks, retries, retained primary DOM, streaming boundaries, and event replay are supported. Work runs without priority scheduling.',
  ],
  [
    'Transitions',
    'startTransition and useTransition run synchronously. Pending stays false. useDeferredValue returns its input. There is no time slicing or interruptible rendering.',
  ],
  [
    'Actions and optimistic state',
    'useActionState returns the initial state, a no-op dispatch, and false. useOptimistic has no optimistic overlay and its setter is a no-op. useFormStatus stays idle.',
  ],
  [
    'Activity',
    'Hidden DOM and state are retained. Effects, refs, and subscriptions disconnect, insertion effects stay connected. Hidden work runs synchronously.',
  ],
  [
    'Server rendering',
    'String, static markup, readable stream, and pipeable stream rendering are supported. Full Fizz prerender and resume APIs are not implemented.',
  ],
  [
    'Server Components',
    'The Vite RSC environment stays on upstream React. Redact does not reimplement Flight serialization.',
  ],
  [
    'Caching',
    'cache returns its function and cacheSignal returns null. Client and DOM-server rendering are uncached.',
  ],
  [
    'Development tools',
    'Fast Refresh works with @vitejs/plugin-react. StrictMode and Profiler render children without double invocation or profiling. React DevTools inspection is not implemented.',
  ],
  [
    'React Compiler',
    'The react/compiler-runtime memo-cache entrypoint is implemented and aliased. Every compiler output pattern has not been validated.',
  ],
]

const flags = [
  ['activity', 'Hidden children unmount and lose state.'],
  ['fragmentRefs', 'No Fragment DOM instance.'],
  [
    'viewTransitions',
    'No native snapshots or animation callbacks, the boundary retains state.',
  ],
  ['portal', 'Children render in place instead of into the target container.'],
  ['context', 'Providers do not propagate values, reads return the default.'],
  [
    'suspense',
    'No fallback UI, thrown thenables still retry when they settle.',
  ],
  ['memo', 'No prop-equality bailout.'],
  ['forwardRef', 'No wrapper forwarding, ordinary ref props still work.'],
  ['lazy', 'Only already-synchronous payloads resolve.'],
  [
    'classComponents',
    'Constructor, render, and setState only, no lifecycles or error boundaries.',
  ],
  ['hydration', 'hydrateRoot throws, use createRoot.'],
]

function RedactPage() {
  return (
    <main className="bg-background-default text-text-primary">
      <div className="mx-auto max-w-7xl px-5 sm:px-10">
        <header className="grid gap-10 py-16 md:grid-cols-[1.2fr_1fr] md:items-end md:py-24">
          <div>
            <h1 className="font-ds-display text-5xl font-bold tracking-tight sm:text-7xl">
              TanStack{' '}
              <span className="line-through decoration-[0.12em]">React</span>{' '}
              Redact
            </h1>
            <p className="mt-6 font-ds-display text-3xl font-bold sm:text-4xl">
              React, redacted.
            </p>
            <p className="mt-5 max-w-xl text-lg font-light leading-relaxed text-text-secondary">
              Keep your components, hooks, and React imports. Swap in a smaller
              runtime that renders synchronously, with one Vite plugin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#install"
                className="rounded-lg bg-text-primary px-5 py-3 font-medium text-background-default"
              >
                Install Redact
              </a>
              <a
                href={repo}
                className="rounded-lg border border-border-default px-5 py-3 font-medium hover:bg-background-subtle"
              >
                GitHub ↗
              </a>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <a
                href="#size"
                className="rounded-xl bg-background-subtle p-5 sm:p-6 hover:opacity-80 transition-colors"
              >
                <span className="block font-ds-display text-4xl font-bold tracking-tight sm:text-5xl">
                  66.3%
                </span>
                <span className="mt-2 block text-sm text-text-secondary">
                  smaller default runtime than React
                </span>
              </a>
              <a
                href="#size"
                className="rounded-xl bg-background-subtle p-5 sm:p-6 hover:opacity-80 transition-colors"
              >
                <span className="block font-ds-display text-4xl font-bold tracking-tight sm:text-5xl">
                  12.5 <span className="text-xl">kB</span>
                </span>
                <span className="mt-2 block text-sm text-text-secondary">
                  nano DOM client, gzipped
                </span>
              </a>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              Redact 0.1.0 measurements. Savings compare all client exports with
              React 19.3.0. Nano disables all optional features. App sizes vary.{' '}
              <a href="#size" className="underline underline-offset-4">
                Measurement details
              </a>
            </p>
            <div className="rounded-xl bg-background-subtle p-4 sm:p-6">
              <CodeBlock dataCodeTitle="vite.config.ts">
                <code className="language-ts">{`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  plugins: [react(), redact()],
})`}</code>
              </CodeBlock>
            </div>
          </div>
        </header>
        <div className="grid gap-10 border-t border-border-default py-12 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
          <aside>
            <nav
              aria-label="On this page"
              className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-text-secondary lg:sticky lg:top-24 lg:flex-col"
            >
              {sections.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="hover:text-text-primary hover:underline underline-offset-4"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>
          <article className="min-w-0 max-w-4xl space-y-16 [&_section]:scroll-mt-24 [&_h2]:mb-6 [&_h2]:font-ds-display [&_h2]:text-3xl [&_h2]:font-bold [&_p]:leading-relaxed [&_p]:text-text-secondary [&_a]:underline [&_a]:underline-offset-4 [&_td]:align-top [&_td]:py-4 [&_td]:pr-6 [&_th]:py-3 [&_th]:pr-6 [&_th]:text-left [&_tr]:border-b [&_tr]:border-border-default">
            <section id="install">
              <h2>One plugin. Same imports.</h2>
              <CodeBlock>
                <code className="language-bash">pnpm add @tanstack/redact</code>
              </CodeBlock>
              <p className="my-5">
                Add <code>redact()</code> to your existing Vite plugins, keep
                your framework and React plugins in place. The plugin aliases
                React, React DOM, server rendering, scheduler, and JSX
                entrypoints for client and SSR builds.
              </p>
              <CodeBlock>
                <code className="language-tsx">{`// Your application code stays familiar.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}

createRoot(document.getElementById('root')!).render(<Counter />)`}</code>
              </CodeBlock>
              <p className="mt-5">
                Redact is a React-compatible runtime, not a complete
                implementation of every React behavior. Check the compatibility
                differences below before switching an existing app.
              </p>
            </section>
            <section id="size">
              <h2>Less runtime to download.</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="pb-4 text-left text-text-secondary">
                    Production ESM runtime bundles, all React, JSX, DOM, and
                    DOM-client exports retained.
                  </caption>
                  <thead>
                    <tr>
                      <th>Runtime</th>
                      <th>Gzip size</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>React 19.3.0</td>
                      <td className="font-mono">69,162 bytes</td>
                    </tr>
                    <tr>
                      <td>Redact, default Vite configuration</td>
                      <td className="font-mono">23,311 bytes</td>
                    </tr>
                    <tr>
                      <td>Redact, native animation enabled</td>
                      <td className="font-mono">28,159 bytes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-5">
                The default bundle was 66.3% smaller in the Redact 0.1.0 release
                measurement from September 11, 2026. These are runtime sizes,
                your app will tree-shake differently, and the runtimes have
                different scheduling capabilities.{' '}
                <a href={`${repo}/blob/main/benchmarks/SHIP_RESULTS.md#size`}>
                  Measurement inputs and configurations ↗
                </a>
              </p>
              <p className="mt-4">
                Measured separately in the same release, the default DOM-client
                entry is 20,139 bytes gzipped and the nano DOM-client entry is
                12,466 bytes. The React API entry is 2,764 bytes. These entries
                overlap, their sizes are not additive. Nano disables all
                optional features and is not a full-compatibility preset.{' '}
                <a href="#features">Choose your feature flags</a>.
              </p>
              <p className="mt-4">
                Performance depends on the workload. Published microbenchmarks
                include faster state updates and slower hydration and Suspense
                retries. They do not establish whole-app speedups.{' '}
                <a href={`${repo}/blob/main/benchmarks/SHIP_MEASUREMENTS.md`}>
                  Read the performance measurements ↗
                </a>
              </p>
            </section>
            <section id="compatibility">
              <h2>Know what changes.</h2>
              <p className="mb-5">
                Redact keeps the React component model and everyday APIs, while
                leaving out concurrent scheduling. These behaviors describe the
                default Vite configuration.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-1/4">Area</th>
                    <th>Redact behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {compatibility.map(([area, behavior]) => (
                    <tr key={area}>
                      <td className="font-medium">{area}</td>
                      <td className="text-text-secondary">{behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5">
                Native view transition animation is experimental and opt-in.
                Production animation, hidden-tab behavior, broader resource and
                navigation races, and Safari and Firefox remain unverified.{' '}
                <a href={`${repo}/blob/main/docs/REACT_19_3_SUPPORT.md`}>
                  Full API support reference ↗
                </a>
              </p>
            </section>
            <section id="features">
              <h2>Only ship the parts you use.</h2>
              <p className="mb-5">
                The default <code>full</code> preset enables every optional
                feature except native animation. Disable behavior your app does
                not use, or start with <code>nano</code> and turn features on
                individually. Overrides merge with the preset.
              </p>
              <CodeBlock>
                <code className="language-ts">{`// A client-rendered app without class components
redact({
  features: { hydration: false, classComponents: false },
})

// Every optional feature off, then context enabled
redact({ preset: 'nano', features: { context: true } })

// Experimental native view transition animation
redact({ features: { viewTransitions: true } })`}</code>
              </CodeBlock>
              <p className="my-5">
                Disabling a feature changes behavior, it does not just remove an
                unused export. The <code>nano</code> preset is not a
                full-compatibility preset. Feature size savings overlap and are
                not additive.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Feature flag</th>
                    <th>When disabled</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map(([flag, behavior]) => (
                    <tr key={flag}>
                      <td>
                        <code>{flag}</code>
                      </td>
                      <td className="text-text-secondary">{behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section id="reference">
              <h2>Vite plugin reference</h2>
              <CodeBlock>
                <code className="language-ts">{`import { redact } from '@tanstack/redact/vite'

redact({
  preset: 'full',
  features: { viewTransitions: false },
})`}</code>
              </CodeBlock>
              <table className="mt-5 w-full text-sm">
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>preset</code>
                    </td>
                    <td className="text-text-secondary">
                      <code>'full' | 'nano'</code>, defaults to{' '}
                      <code>'full'</code>.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>features</code>
                    </td>
                    <td className="text-text-secondary">
                      Boolean overrides for the feature flags above.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>skip</code>
                    </td>
                    <td className="text-text-secondary">
                      An array of import specifiers to leave out of aliasing.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>resolveFrom</code>
                    </td>
                    <td className="text-text-secondary">
                      Package resolution root, defaults to the Vite config root.
                      Useful in monorepos.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>packageRoots</code>
                    </td>
                    <td className="text-text-secondary">
                      A map of package names to absolute package directories,
                      bypassing node_modules lookup for local builds.
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-5">
                For runtime internals and manual configuration, see the{' '}
                <a href={`${repo}/blob/main/docs/DEVELOPMENT.md`}>
                  development guide ↗
                </a>
                .
              </p>
            </section>
            <section id="verification">
              <h2>Try it with your app.</h2>
              <p>
                Run your tests and production build, then check hydration,
                forms, portals, navigation, and any third-party components your
                app uses. Pay particular attention to code that depends on
                pending transitions, actions, optimistic state, or React
                DevTools.
              </p>
              <p className="mt-4">
                The repository publishes{' '}
                <a href={`${repo}/blob/main/benchmarks/SHIP_CHROME_FINAL.md`}>
                  browser test results
                </a>
                ,{' '}
                <a href={`${repo}/blob/main/benchmarks/RELEASE_0_1_0_SITES.md`}>
                  real-app integration checks
                </a>
                , and{' '}
                <a href={`${repo}/blob/main/benchmarks/README.md`}>
                  benchmark reproduction instructions
                </a>
                . Use those alongside your own app's checks when deciding
                whether to switch.
              </p>
            </section>
          </article>
        </div>
      </div>
    </main>
  )
}
