import * as React from 'react'
import {
  ArrowRightIcon,
  CodeIcon,
  HardDrivesIcon,
  PlayIcon,
  CheckIcon,
  ArrowDownIcon,
} from '@phosphor-icons/react'
import { getStartHostingPartners } from '~/utils/start-hosting-partners'
import { getPartnersForPlacement } from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'
import { LandingWindow, LibraryLandingShell } from './LibraryLanding'
import { LandingCopyPromptButton } from './LandingCopyPromptButton'
import './start-landing.css'

const startPrompt =
  'Build it with TanStack Start. Use TanStack Router for type-safe routes, search params, and loaders, and typed server functions for server-only work. Read the current TanStack documentation and installed package skills before implementing.'
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

export default function StartLanding() {
  return (
    <div className="start-launch">
      <LibraryLandingShell
        libraryId="start"
        headline="A full-stack framework for React and Solid."
        description="Feels like building a SPA, with the whole server behind you. Type-safe routing, server rendering, streaming, and server functions, all in the same app."
        beforeActions={
          <div className="mt-5 flex flex-wrap gap-5 text-ds-body-sm">
            <a className="start-release" href="/blog/tanstack-start-1-0">
              1.0 is stable <ArrowRightIcon size={16} />
            </a>
            <a className="start-release" href="#start-film">
              Watch the launch <PlayIcon size={14} weight="fill" />
            </a>
          </div>
        }
        hero={<AppAndServer />}
        prompt={startPrompt}
        promptLabel="Copy prompt"
      >
        <section className="start-type-section start-section">
          <div className="start-section-copy">
            <h2>
              Change your mind.
              <br />
              <em>Your types keep up.</em>
            </h2>
            <p>
              Rename a route parameter. Change what your server returns. Your
              editor knows what else needs to change, all the way to the
              component using it.
            </p>
            <a href="/router/latest/docs/framework/react/guide/type-safety">
              Built on TanStack Router <ArrowRightIcon size={18} />
            </a>
          </div>
          <TypeConnection />
        </section>

        <section className="start-render-section start-section">
          <div className="start-section-copy">
            <h2>
              You decide what
              <br />
              runs where.
            </h2>
            <p>
              Server rendering, streaming, server functions, and middleware,
              without having to rethink your entire app. You can even choose how
              each route renders.
            </p>
            <a href="/start/latest/docs/framework/react/guide/selective-ssr">
              Explore rendering options <ArrowRightIcon size={18} />
            </a>
          </div>
          <ExecutionMapHero />
        </section>

        <section className="start-ai-section start-section">
          <h2>
            Tell your AI:
            <br />
            <em>
              “Build it with
              <br />
              TanStack Start.”
            </em>
          </h2>
          <div className="start-ai-copy">
            <p>
              The same explicit APIs and strict types that help you build help
              your agent, too. And with TanStack Intent, guidance ships with the
              packages it’s using.
            </p>
            <LandingCopyPromptButton
              prompt={startPrompt}
              label="Copy the prompt"
              className="start-button"
            />
            <a href="/intent/latest">
              Meet TanStack Intent <ArrowRightIcon size={18} />
            </a>
          </div>
        </section>
        <HostingLinks />
        <section id="start-film" className="start-film start-section">
          <LaunchFilm />
        </section>
      </LibraryLandingShell>
    </div>
  )
}

function AppAndServer() {
  const [view, setView] = React.useState('Projects')
  const [server, setServer] = React.useState(false)
  return (
    <div className="start-demo" data-server={server}>
      <div className="start-app">
        <div className="start-app-toolbar">
          <span className="start-app-brand">◒ Daybreak</span>
          <span>daybreak.local/{view.toLowerCase()}</span>
          <span className="start-avatar">JD</span>
        </div>
        <div className="start-app-body">
          <nav aria-label="Example application">
            <span>Workspace</span>
            {['Projects', 'Activity', 'Team'].map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                aria-pressed={view === item}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="start-projects" aria-live="polite">
            <div className="start-project-heading">
              <h3>{view}</h3>
              <span>Acme Studio</span>
            </div>
            {view === 'Projects' ? (
              <>
                {[
                  ['Website refresh', 'Design', '72%'],
                  ['Customer portal', 'Development', '46%'],
                  ['Mobile experience', 'Planning', '24%'],
                ].map(([name, state, progress]) => (
                  <div className="start-project-row" key={name}>
                    <span className="start-project-icon">{name.charAt(0)}</span>
                    <div>
                      <strong>{name}</strong>
                      <small>{state}</small>
                    </div>
                    <span className="start-progress">
                      <i
                        style={{
                          transform: `scaleX(${parseInt(progress) / 100})`,
                        }}
                      />
                    </span>
                    <span>{progress}</span>
                  </div>
                ))}
              </>
            ) : view === 'Activity' ? (
              <>
                <p className="start-activity">
                  <CheckIcon /> Website refresh moved to design review.
                </p>
                <p className="start-activity">
                  <CheckIcon /> Customer portal preview deployed.
                </p>
                <p className="start-activity">
                  <CheckIcon /> Mobile experience brief approved.
                </p>
              </>
            ) : (
              <>
                {['Jamie, Design', 'Alex, Engineering', 'Morgan, Product'].map(
                  (name) => (
                    <div className="start-project-row" key={name}>
                      <span className="start-avatar">{name[0]}</span>
                      <strong>{name}</strong>
                    </div>
                  ),
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <button
        className="start-server-toggle"
        aria-expanded={server}
        onClick={() => setServer(!server)}
      >
        {server ? 'Back to the app' : 'See what’s behind it'}{' '}
        <ArrowDownIcon size={18} />
      </button>
      <div className="start-server-layer" aria-hidden={!server}>
        <div className="start-server-line" />
        <div className="start-server-rack">
          <HardDrivesIcon size={26} />
          <strong>Your server</strong>
          <span>SSR</span>
          <span>Streaming</span>
          <span>Server functions</span>
        </div>
      </div>
    </div>
  )
}

function TypeConnection() {
  const [field, setField] = React.useState<'name' | 'title'>('name')
  return (
    <div className="start-types">
      <div className="start-code-title">
        <span>server/project.ts</span>
        <button onClick={() => setField(field === 'name' ? 'title' : 'name')}>
          Rename {field} to {field === 'name' ? 'title' : 'name'}{' '}
          <ArrowRightIcon size={14} />
        </button>
      </div>
      <pre>
        <code>
          <span className="start-code-muted">export const</span> getProject =
          createServerFn(){'\n  '}.handler(async () =&gt; ({'{'}
          {'\n    '}id: 42,{'\n    '}
          <mark>{field}</mark>: 'Website refresh',{'\n  '}&#125;))
        </code>
      </pre>
      <div className="start-type-connector">
        <ArrowDownIcon size={18} />
        <span>Inferred through your route loader</span>
      </div>
      <div className="start-code-title">
        <span>routes/projects.tsx</span>
      </div>
      <pre>
        <code>
          {
            "export const Route = createFileRoute('/projects')({\n  loader: () => getProject(),\n})\n\n"
          }
          const project = Route.useLoaderData(){'\n\n'}&lt;h1&gt;{'{'}project.
          <mark>{field}</mark>
          {'}'}&lt;/h1&gt;
        </code>
      </pre>
      <div className="start-inferred" aria-live="polite">
        <CheckIcon size={16} />
        <code>
          project: {'{'} id: number; {field}: string {'}'}
        </code>
      </div>
      <p className="start-code-note">
        Illustration of the inferred type. Your editor flags old references when
        you rename a field.
      </p>
    </div>
  )
}

function HostingLinks() {
  const context = usePartnerPlacementContext({
    category: 'deployment',
    orderStrategy: 'tier-rotated',
    surface: 'start_deployment',
  })
  const partners = getPartnersForPlacement(getStartHostingPartners(), context)
  return (
    <section className="start-hosting start-section">
      <div>
        <h2>
          Your app.
          <br />
          Your infrastructure.
        </h2>
        <p>Deploy to the platform you like. Keep the app you built.</p>
        <a href="/start/latest/docs/framework/react/guide/hosting">
          Deployment guides <ArrowRightIcon size={18} />
        </a>
      </div>
      <div className="start-hosts">
        {partners.map((partner) => (
          <a key={partner.id} href={partner.href}>
            {partner.name}
            <ArrowRightIcon size={18} />
          </a>
        ))}
        <a href="/start/latest/docs/framework/react/guide/hosting">
          Node.js <ArrowRightIcon size={18} />
        </a>
      </div>
    </section>
  )
}

function LaunchFilm() {
  const [playing, setPlaying] = React.useState(false)
  const video = React.useRef<HTMLVideoElement>(null)
  return (
    <div className="start-film-frame">
      <video
        ref={video}
        controls={playing}
        preload="none"
        playsInline
        poster="https://media.tanstack.com/blog/tanstack-start-1-0/v11-title-poster.jpg"
        src="https://media.tanstack.com/blog/tanstack-start-1-0/v11.mp4"
        onPlay={() => setPlaying(true)}
        aria-label="TanStack Start 1.0 launch video"
      >
        <track
          kind="captions"
          src="/blog-assets/tanstack-start-1-0/captions.vtt"
          srcLang="en"
          label="English"
        />
      </video>
      {!playing && (
        <button
          aria-label="Play the TanStack Start launch video"
          onClick={() => {
            void video.current?.play().catch(() => setPlaying(false))
          }}
        >
          <PlayIcon size={32} weight="fill" />
        </button>
      )}
    </div>
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
            icon={<HardDrivesIcon aria-hidden="true" size={17} />}
            label="server"
            steps={mode.server}
          />
          <div className="flex items-center justify-center py-1 text-[var(--landing-accent-bright)] md:px-1">
            <ArrowRightIcon
              aria-hidden="true"
              className="rotate-90 md:rotate-0"
              size={22}
            />
          </div>
          <RuntimeColumn
            icon={<CodeIcon aria-hidden="true" size={17} />}
            label="browser"
            steps={mode.browser}
          />
        </div>

        <div className="mt-4 rounded-r-lg border-l-2 border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] px-4 py-3">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            {mode.label}
          </p>
          <p className="mt-2 text-ds-body-xs text-text-primary/75">
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
            <span className="font-ds-mono text-ds-mono-2xs text-text-primary/80">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
