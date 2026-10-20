import type { BuilderAiEvalCase } from './types'

export const builderAiEvalCases = [
  {
    id: 'charts-basic-bar',
    title: 'TanStack Charts bar chart',
    prompt: 'Build me a bar chart using TanStack Charts.',
    tags: ['charts', 'client'],
    timeoutMs: 6 * 60_000,
    workspaceChecks: [
      {
        kind: 'runtime',
        description: 'keeps the built-in client runtime',
        runtime: 'client',
      },
      {
        kind: 'module',
        description: 'imports TanStack Charts',
        specifier: '@tanstack/charts',
      },
    ],
    previewSteps: [
      {
        description: 'renders a branded, accessible chart',
        checks: [
          {
            kind: 'selector',
            description: 'renders a TanStack Charts SVG',
            selector:
              'svg.ts-chart[role="img"][aria-roledescription="chart"][aria-label]:not([aria-label=""])',
            minimum: 1,
          },
          {
            kind: 'geometry',
            description: 'renders a visible bar',
            selector: 'rect[data-ts-key*="bar-"]',
            minimum: 1,
          },
          {
            kind: 'text',
            description: 'does not render invalid geometry',
            text: 'NaN',
            absent: true,
          },
          {
            kind: 'text',
            description: 'does not render infinite geometry',
            text: 'Infinity',
            absent: true,
          },
        ],
      },
      {
        description: 'survives a narrow viewport',
        action: { kind: 'resize', width: 760, height: 780 },
        checks: [
          {
            kind: 'geometry',
            description: 'keeps visible bars after resize',
            selector: 'rect[data-ts-key*="bar-"]',
            minimum: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'react-query-refetch',
    title: 'React Query async refetch',
    prompt:
      'Build an Issue Queue demo using TanStack Query. An async local query should return exactly Router hydration, Chart scales, and Table sorting. Show a heading, those three issues, a visible revision number starting at Revision 1, loading and refresh states, and a Refetch issues button. Each refetch should increment the visible revision.',
    tags: ['query', 'client'],
    timeoutMs: 6 * 60_000,
    workspaceChecks: [
      {
        kind: 'runtime',
        description: 'uses the client runtime',
        runtime: 'client',
      },
      {
        kind: 'module',
        description: 'imports TanStack React Query',
        specifier: '@tanstack/react-query',
      },
      {
        kind: 'call',
        description: 'executes the React Query hook',
        callee: 'useQuery',
      },
    ],
    previewSteps: [
      {
        description: 'loads the deterministic issue list',
        checks: [
          {
            kind: 'selector',
            description: 'renders three issue rows',
            selector: 'li',
            minimum: 3,
            maximum: 3,
          },
          {
            kind: 'text',
            description: 'renders Router hydration',
            text: 'Router hydration',
          },
          {
            kind: 'text',
            description: 'renders Chart scales',
            text: 'Chart scales',
          },
          {
            kind: 'text',
            description: 'renders Table sorting',
            text: 'Table sorting',
          },
          {
            kind: 'text',
            description: 'renders the first revision',
            text: 'Revision 1',
          },
        ],
      },
      {
        description: 'refetches through the rendered control',
        action: { kind: 'click', selector: 'button', text: 'Refetch issues' },
        checks: [
          {
            kind: 'text',
            description: 'renders the second revision after refetch',
            text: 'Revision 2',
          },
        ],
      },
    ],
  },
  {
    id: 'react-table-people',
    title: 'TanStack Table filtering and sorting',
    prompt:
      'Build a semantic People table using TanStack Table with these rows: Ada Lovelace, age 36, London; Grace Hopper, age 85, Arlington; Alan Turing, age 41, Wilmslow; Katherine Johnson, age 101, White Sulphur Springs. Add a global search input labeled Search people, sortable Name and Age columns with aria-sort, and a visible aria-live result count that reads 4 people initially and 1 person when filtered to Grace.',
    tags: ['table', 'client'],
    timeoutMs: 6 * 60_000,
    workspaceChecks: [
      {
        kind: 'runtime',
        description: 'uses the client runtime',
        runtime: 'client',
      },
      {
        kind: 'module',
        description: 'imports TanStack React Table',
        specifier: '@tanstack/react-table',
      },
      {
        kind: 'call',
        description: 'executes the installed v9 table API',
        callee: 'useTable',
      },
      {
        kind: 'call',
        description: 'does not fall back to the v8 constructor',
        callee: 'useReactTable',
        negate: true,
      },
    ],
    previewSteps: [
      {
        description: 'renders the semantic table',
        checks: [
          {
            kind: 'selector',
            description: 'renders four table rows',
            selector: 'tbody tr',
            minimum: 4,
            maximum: 4,
          },
          {
            kind: 'label',
            description: 'labels the search field',
            label: 'Search people',
            minimum: 1,
          },
          {
            kind: 'selector',
            description: 'exposes sortable columns to assistive technology',
            selector: '[aria-sort]',
            minimum: 2,
          },
          {
            kind: 'selector',
            description: 'announces the visible result count',
            selector: '[aria-live]',
            minimum: 1,
            textIncludes: ['4 people'],
          },
        ],
      },
      {
        description: 'filters with the search field',
        action: {
          kind: 'fill',
          selector: 'input',
          value: 'Grace',
        },
        checks: [
          {
            kind: 'selector',
            description: 'filters to one row',
            selector: 'tbody tr',
            minimum: 1,
            maximum: 1,
            textIncludes: ['Grace Hopper'],
          },
          {
            kind: 'selector',
            description: 'updates the visible result count',
            selector: '[aria-live]',
            minimum: 1,
            textIncludes: ['1 person'],
          },
        ],
      },
      {
        description: 'clears the search field',
        action: { kind: 'fill', selector: 'input', value: '' },
        checks: [
          {
            kind: 'selector',
            description: 'restores all four rows',
            selector: 'tbody tr',
            minimum: 4,
            maximum: 4,
          },
        ],
      },
      {
        description: 'sorts ages ascending',
        action: {
          kind: 'clickUntil',
          selector: 'button',
          text: 'Age',
          untilSelector: '[aria-sort="ascending"]',
          untilText: 'Age',
          maximumClicks: 2,
        },
        checks: [
          {
            kind: 'texts',
            description: 'orders ages from youngest to oldest',
            selector: 'tbody tr td:nth-child(2)',
            expected: ['36', '41', '85', '101'],
          },
        ],
      },
      {
        description: 'sorts ages descending',
        action: { kind: 'click', selector: 'button', text: 'Age' },
        checks: [
          {
            kind: 'texts',
            description: 'orders ages from oldest to youngest',
            selector: 'tbody tr td:nth-child(2)',
            expected: ['101', '85', '41', '36'],
          },
        ],
      },
    ],
  },
  {
    id: 'tanstack-start-routes',
    title: 'TanStack Start routes and server function',
    prompt:
      'Turn this builder into a full TanStack Start app named Project Atlas. The home route should link to /issues with the text View issues. The /issues route must load exactly Router hydration, Chart scales, and Table sorting from a createServerFn server function. Use file-based routes, set the document title to Project Atlas, and make client navigation and direct reloads work.',
    tags: ['start', 'webcontainer'],
    timeoutMs: 12 * 60_000,
    workspaceChecks: [
      {
        kind: 'runtime',
        description: 'upgrades to WebContainer',
        runtime: 'webcontainer',
      },
      {
        kind: 'dependency',
        description: 'installs TanStack Start',
        packageName: '@tanstack/react-start',
      },
      {
        kind: 'dependency',
        description: 'installs TanStack Router',
        packageName: '@tanstack/react-router',
      },
      {
        kind: 'call',
        description: 'uses a TanStack Start server function',
        callee: 'createServerFn',
      },
      {
        kind: 'module',
        description: 'configures the TanStack Start Vite plugin',
        specifier: '@tanstack/react-start/plugin/vite',
      },
      {
        kind: 'call',
        description: 'activates the TanStack Start Vite plugin',
        callee: 'tanstackStart',
      },
    ],
    previewSteps: [
      {
        description: 'renders the home route',
        checks: [
          {
            kind: 'title',
            description: 'sets the document title',
            text: 'Project Atlas',
          },
          {
            kind: 'selector',
            description: 'renders the issues link',
            selector: 'a[href="/issues"]',
            minimum: 1,
            textIncludes: ['View issues'],
          },
        ],
      },
      {
        description: 'navigates without replacing the document',
        action: { kind: 'click', selector: 'a[href="/issues"]' },
        documentMustPersist: true,
        checks: [
          {
            kind: 'url',
            description: 'navigates to /issues',
            pathname: '/issues',
          },
          {
            kind: 'text',
            description: 'renders Router hydration from the server function',
            text: 'Router hydration',
          },
          {
            kind: 'text',
            description: 'renders Chart scales from the server function',
            text: 'Chart scales',
          },
          {
            kind: 'text',
            description: 'renders Table sorting from the server function',
            text: 'Table sorting',
          },
        ],
      },
      {
        description: 'loads the issues route directly',
        action: { kind: 'reload' },
        checks: [
          {
            kind: 'url',
            description: 'keeps /issues after a direct reload',
            pathname: '/issues',
          },
          {
            kind: 'title',
            description: 'keeps the document title after reload',
            text: 'Project Atlas',
          },
          {
            kind: 'text',
            description: 'loads server data after a direct reload',
            text: 'Router hydration',
          },
        ],
      },
    ],
  },
] satisfies ReadonlyArray<BuilderAiEvalCase>
