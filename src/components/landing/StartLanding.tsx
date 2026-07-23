import * as React from 'react'
import {
  ArrowRight,
  BracketsCurly,
  Cloud,
  Code,
  GitBranch,
  HardDrives,
  Network,
  Rocket,
  ShieldCheck,
  Stack,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const startPrompt = [
  'Build a TanStack Start application with file-based TanStack Router routes, validated search params, route loaders, typed server functions, full-document SSR, and streaming.',
  'Keep server-only work behind explicit boundaries, choose the appropriate SSR mode per route, and target the deployment runtime without changing the application model.',
].join(' ')

const renderModes = [
  {
    id: 'full',
    label: 'Full SSR',
    value: 'ssr: true',
    server: ['beforeLoad', 'loader', 'component', 'stream HTML'],
    browser: ['hydrate HTML', 'client navigation'],
    note: 'Data and markup arrive ready to hydrate.',
  },
  {
    id: 'data',
    label: 'Data only',
    value: "ssr: 'data-only'",
    server: ['beforeLoad', 'loader', 'serialize data'],
    browser: ['render component', 'client navigation'],
    note: 'Run route data on the server, render its UI in the browser.',
  },
  {
    id: 'client',
    label: 'Client only',
    value: 'ssr: false',
    server: ['defer route'],
    browser: ['beforeLoad', 'loader', 'render component'],
    note: 'Keep browser-only routes entirely on the client.',
  },
] as const

const boundaryExamples = [
  {
    id: 'serverFn',
    label: 'Server function',
    title: 'Typed work called from the app',
    code: "const getProject = createServerFn({ method: 'GET' })\n  .validator(projectSchema)\n  .handler(({ data }) => db.projects.find(data.id))",
    flow: [
      'component or loader',
      'validated request',
      'server-only handler',
      'typed result',
    ],
  },
  {
    id: 'serverRoute',
    label: 'Server route',
    title: 'An endpoint for outside callers',
    code: "export const Route = createFileRoute('/api/webhook')({\n  server: {\n    handlers: {\n      POST: async ({ request }) => handleWebhook(request),\n    },\n  },\n})",
    flow: ['external request', 'server route', 'response'],
  },
  {
    id: 'middleware',
    label: 'Middleware',
    title: 'Request policy that composes',
    code: 'const auth = createMiddleware()\n  .middleware([logging])\n  .server(async ({ next }) => next({ context: { user } }))',
    flow: ['request', 'logging', 'authentication', 'handler'],
  },
] as const

const deploymentTargets = [
  {
    label: 'Cloudflare Workers',
    output: 'Worker runtime',
    command: 'wrangler deploy',
  },
  {
    label: 'Node.js',
    output: 'Node server',
    command: 'node .output/server/index.mjs',
  },
  { label: 'Netlify', output: 'Netlify functions', command: 'netlify deploy' },
  { label: 'Railway', output: 'Node service', command: 'railway up' },
] as const

export default function StartLanding() {
  return (
    <LibraryLandingShell
      libraryId="start"
      headline="One Router-first app, from server request to client navigation."
      description="Start keeps TanStack Router as the application contract, then adds full-document rendering, streaming, typed server work, middleware, and output for the runtime you choose."
      hero={<ExecutionMapHero />}
      prompt={startPrompt}
      promptLabel="Copy Start prompt"
    >
      <LandingSection tone="raised">
        <div className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <LandingSectionIntro
            eyebrow="Router at the core"
            icon={<GitBranch aria-hidden="true" size={15} />}
            title="The framework does not replace the application model."
            body="Routes, params, search schemas, loaders, links, pending states, and boundaries stay TanStack Router. Start adds the server and build layers around that same tree."
          />
          <RouterFoundation />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-start gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Explicit boundaries"
            icon={<ShieldCheck aria-hidden="true" size={15} />}
            title="Server work is visible in the code that calls it."
            body="Use server functions for type-safe app calls, server routes for outside callers, and composable middleware for authentication, context, logging, and policy."
          />
          <ServerBoundaryLab />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Portable application model"
          icon={<Rocket aria-hidden="true" size={15} />}
          title="Keep the routes. Change the output."
          body="Start supports Vite and Rsbuild and is designed for different hosting providers and runtimes. Deployment configuration changes; route authoring and server boundaries do not."
        />
        <DeploymentSelector />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function ExecutionMapHero() {
  const [activeMode, setActiveMode] = React.useState<
    'full' | 'data' | 'client'
  >('full')
  const mode =
    renderModes.find((item) => item.id === activeMode) ?? renderModes[0]

  return (
    <LandingWindow label="route execution map">
      <div className="p-4 sm:p-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="SSR mode"
        >
          {renderModes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === activeMode}
              className="rounded-lg border border-border-default bg-background-subtle px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.16)]"
              onClick={() => setActiveMode(item.id)}
            >
              <span className="block text-ds-label-sm text-text-primary/75">
                {item.label}
              </span>
              <span className="mt-1 block font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
                {item.value}
              </span>
            </button>
          ))}
        </div>

        <div
          className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch"
          aria-live="polite"
        >
          <RuntimeColumn
            icon={<HardDrives aria-hidden="true" size={17} />}
            label="server"
            steps={mode.server}
          />
          <div className="flex items-center justify-center py-1 text-[var(--landing-accent-bright)] md:px-1">
            <ArrowRight
              aria-hidden="true"
              className="rotate-90 md:rotate-0"
              size={22}
            />
          </div>
          <RuntimeColumn
            icon={<Code aria-hidden="true" size={17} />}
            label="browser"
            steps={mode.browser}
          />
        </div>

        <div className="mt-4 rounded-lg border-l-2 border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] px-4 py-3">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            {mode.label}
          </p>
          <p className="mt-2 text-ds-body-xs text-text-primary/45">
            {mode.note}
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function RuntimeColumn({
  icon,
  label,
  steps,
}: {
  icon: React.ReactNode
  label: string
  steps: readonly string[]
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-background-subtle p-4">
      <div className="flex items-center gap-2 text-[var(--landing-accent-bright)]">
        {icon}
        <p className="font-ds-mono text-ds-mono-caps-xs uppercase">{label}</p>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex items-center gap-3 rounded-lg bg-background-default px-3 py-2.5"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--landing-accent)] font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-ink)]">
              {index + 1}
            </span>
            <span className="font-ds-mono text-ds-mono-2xs text-text-primary/65">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function RouterFoundation() {
  const layers = [
    {
      label: 'Start server layer',
      detail: 'SSR · streaming · server functions · routes · middleware',
      icon: HardDrives,
      accent: true,
    },
    {
      label: 'TanStack Router',
      detail: 'route tree · URL state · loaders · links · boundaries',
      icon: Network,
      accent: false,
    },
    {
      label: 'Your application',
      detail: 'components · data clients · product behavior',
      icon: Stack,
      accent: false,
    },
  ] as const

  return (
    <div className="space-y-3">
      {layers.map((layer, index) => {
        const Icon = layer.icon
        return (
          <div
            key={layer.label}
            className={
              layer.accent
                ? 'relative rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.16)] p-5 shadow-[0_18px_50px_rgb(var(--landing-glow)/0.12)]'
                : 'relative rounded-xl border border-border-default bg-background-surface p-5'
            }
            style={{
              marginInline:
                index === 1 ? '1.5rem' : index === 2 ? '3rem' : undefined,
            }}
          >
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]">
                <Icon aria-hidden="true" size={19} />
              </span>
              <div>
                <h3 className="text-ds-heading-4">{layer.label}</h3>
                <p className="mt-2 font-ds-mono text-ds-mono-2xs text-text-primary/35">
                  {layer.detail}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ServerBoundaryLab() {
  const [activeId, setActiveId] = React.useState<
    'serverFn' | 'serverRoute' | 'middleware'
  >('serverFn')
  const active =
    boundaryExamples.find((item) => item.id === activeId) ?? boundaryExamples[0]

  return (
    <LandingWindow label="server boundary">
      <div className="border-b border-border-subtle px-4 pt-4">
        <div
          className="flex gap-5 overflow-x-auto"
          role="group"
          aria-label="Server boundary type"
        >
          {boundaryExamples.map((example) => (
            <button
              key={example.id}
              type="button"
              aria-pressed={activeId === example.id}
              className="shrink-0 border-b-2 border-transparent pb-3 text-ds-label-sm text-text-primary/35 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-text-primary"
              onClick={() => setActiveId(example.id)}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite" className="p-5">
        <h3 className="text-ds-heading-4">{active.title}</h3>
        <pre className="mt-5 overflow-x-auto rounded-lg bg-ds-neutral-500 p-4">
          <code className="font-ds-mono text-ds-mono-xs text-white/65">
            {active.code}
          </code>
        </pre>
        <ol className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
          {active.flow.map((step, index) => (
            <React.Fragment key={step}>
              <li className="min-w-0 flex-1 rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] px-3 py-2 text-center font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
                {step}
              </li>
              {index < active.flow.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="mx-auto h-3 w-px bg-[var(--landing-accent)] sm:h-px sm:w-4"
                />
              ) : null}
            </React.Fragment>
          ))}
        </ol>
      </div>
    </LandingWindow>
  )
}

function DeploymentSelector() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const active = deploymentTargets[activeIndex] ?? deploymentTargets[0]

  return (
    <div className="mx-auto mt-14 grid max-w-[72rem] gap-5 lg:grid-cols-[0.72fr_1.28fr]">
      <div className="space-y-2" role="group" aria-label="Deployment target">
        {deploymentTargets.map((target, index) => (
          <button
            key={target.label}
            type="button"
            aria-pressed={index === activeIndex}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-border-subtle bg-background-subtle px-5 py-4 text-left text-text-primary/45 hover:border-border-default hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.12)] aria-pressed:text-text-primary"
            onClick={() => setActiveIndex(index)}
          >
            <span className="text-ds-label-md">{target.label}</span>
            <Cloud aria-hidden="true" className="shrink-0" size={19} />
          </button>
        ))}
      </div>

      <LandingWindow label="deployment output">
        <div className="p-6" aria-live="polite">
          <div className="flex items-start justify-between gap-5">
            <div>
              <LandingEyebrow>selected target</LandingEyebrow>
              <h3 className="mt-4 text-ds-heading-2">{active.label}</h3>
            </div>
            <Rocket
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={30}
              weight="light"
            />
          </div>
          <dl className="mt-7 grid gap-px overflow-hidden rounded-lg bg-text-primary/5 sm:grid-cols-2">
            <div className="bg-background-subtle p-4">
              <dt className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                output
              </dt>
              <dd className="mt-2 text-ds-label-md text-text-primary/80">
                {active.output}
              </dd>
            </div>
            <div className="bg-background-subtle p-4">
              <dt className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                deploy
              </dt>
              <dd className="mt-2 break-words font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
                {active.command}
              </dd>
            </div>
          </dl>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {[
              'createFileRoute()',
              'createServerFn()',
              'middleware()',
              'route loaders',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background-default px-3 py-2.5 font-ds-mono text-ds-mono-2xs text-text-primary/55"
              >
                <BracketsCurly
                  aria-hidden="true"
                  className="text-[var(--landing-accent-bright)]"
                  size={14}
                />
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-ds-body-xs text-text-primary/35">
            The authoring surface stays the same.
          </p>
        </div>
      </LandingWindow>
    </div>
  )
}
