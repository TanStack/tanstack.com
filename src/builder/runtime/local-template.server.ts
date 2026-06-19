const minimalLocalForgeFileOverrides: Record<string, string> = {
  'public/manifest.json': `${JSON.stringify(
    {
      short_name: 'App',
      name: 'App',
      icons: [
        {
          src: 'favicon.ico',
          sizes: '64x64 32x32 24x24 16x16',
          type: 'image/x-icon',
        },
      ],
      start_url: '/',
      display: 'standalone',
      theme_color: '#f8fafc',
      background_color: '#f8fafc',
    },
    null,
    2,
  )}\n`,
  'src/components/Header.tsx': `import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            activeProps={{ className: 'nav-link is-active' }}
            className="nav-link"
            to="/"
          >
            Home
          </Link>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  )
}
`,
  'src/routes/__root.tsx': `import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Header from '../components/Header'
import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = \`(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();\`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'App',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
`,
  'src/routes/index.tsx': `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-5xl px-6 py-12 sm:py-16">
      <section className="w-full max-w-2xl">
        <p className="mb-3 text-sm font-medium text-[var(--sea-ink-soft)]">
          Ready
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          Start building.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[var(--sea-ink-soft)]">
          This is a clean TanStack Start workspace. Edit{' '}
          <code>src/routes/index.tsx</code> or ask Forge to generate the first
          version of your app.
        </p>
      </section>
    </main>
  )
}
`,
  'src/styles.css': `@import "tailwindcss";

:root {
  --sea-ink: #111827;
  --sea-ink-soft: #5b6472;
  --line: rgba(15, 23, 42, 0.12);
  --header-bg: rgba(255, 255, 255, 0.72);
  --chip-bg: rgba(255, 255, 255, 0.8);
  --chip-line: rgba(15, 23, 42, 0.14);
  --bg-base: #f8fafc;
  --bg-muted: #eef2f7;
  --surface: rgba(255, 255, 255, 0.76);
}

:root[data-theme="dark"] {
  --sea-ink: #f4f7fb;
  --sea-ink-soft: #aab4c1;
  --line: rgba(226, 232, 240, 0.12);
  --header-bg: rgba(11, 15, 22, 0.72);
  --chip-bg: rgba(17, 24, 39, 0.82);
  --chip-line: rgba(226, 232, 240, 0.14);
  --bg-base: #080c12;
  --bg-muted: #111827;
  --surface: rgba(15, 23, 42, 0.74);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --sea-ink: #f4f7fb;
    --sea-ink-soft: #aab4c1;
    --line: rgba(226, 232, 240, 0.12);
    --header-bg: rgba(11, 15, 22, 0.72);
    --chip-bg: rgba(17, 24, 39, 0.82);
    --chip-line: rgba(226, 232, 240, 0.14);
    --bg-base: #080c12;
    --bg-muted: #111827;
    --surface: rgba(15, 23, 42, 0.74);
  }
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  color: var(--sea-ink);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background:
    linear-gradient(145deg, rgba(14, 165, 233, 0.08), transparent 32%),
    linear-gradient(225deg, rgba(168, 85, 247, 0.06), transparent 38%),
    linear-gradient(180deg, var(--bg-base), var(--bg-muted));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  border: 1px solid var(--line);
  border-radius: 0.375rem;
  background: var(--surface);
  padding: 0.125rem 0.375rem;
  font-size: 0.9em;
}

button,
a {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.nav-link {
  color: var(--sea-ink-soft);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.nav-link:hover,
.nav-link.is-active {
  color: var(--sea-ink);
}
`,
}

const minimalLocalForgeRemovedPaths = [
  'public/logo192.png',
  'public/logo512.png',
  'src/components/Footer.tsx',
  'src/routes/about.tsx',
] as const

export function createMinimalLocalForgeSeedFiles(
  files: Record<string, string>,
) {
  const nextFiles = {
    ...files,
    ...minimalLocalForgeFileOverrides,
  }

  for (const filePath of minimalLocalForgeRemovedPaths) {
    delete nextFiles[filePath]
  }

  return nextFiles
}

export function minimalLocalForgeSeedNeedsUpdate(
  files: Record<string, string>,
) {
  for (const [filePath, contents] of Object.entries(
    minimalLocalForgeFileOverrides,
  )) {
    if (files[filePath] !== contents) {
      return true
    }
  }

  return minimalLocalForgeRemovedPaths.some((filePath) => filePath in files)
}
