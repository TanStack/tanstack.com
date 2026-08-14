import type { Framework, LibraryId } from '../libraries/types'
import type { ExampleRuntime } from './example-workspace'

type ClientExampleConfig = {
  autoStart?: boolean
  entry: string
  framework: Framework
  libraryId: LibraryId
  runtime?: ExampleRuntime
  slug: string
}

function clientExamples({
  entry,
  framework,
  libraryId,
  slugs,
}: {
  entry: string
  framework: Framework
  libraryId: LibraryId
  slugs: ReadonlyArray<string>
}): Array<ClientExampleConfig> {
  return slugs.map((slug) => ({ entry, framework, libraryId, slug }))
}

const clientExampleConfigs: ReadonlyArray<ClientExampleConfig> = [
  ...clientExamples({
    entry: '/src/index.tsx',
    framework: 'react',
    libraryId: 'store',
    slugs: ['simple', 'atoms', 'stores', 'store-actions', 'store-context'],
  }),
  ...clientExamples({
    entry: '/src/main.tsx',
    framework: 'react',
    libraryId: 'virtual',
    slugs: ['chat', 'fixed', 'pretext', 'table', 'window'],
  }),
  {
    entry: '/src/main.ts',
    framework: 'lit',
    libraryId: 'virtual',
    slug: 'fixed',
  },
  ...clientExamples({
    entry: '/src/index.tsx',
    framework: 'react',
    libraryId: 'pacer',
    slugs: [
      'asyncBatch',
      'asyncDebounce',
      'asyncRateLimit',
      'asyncRetry',
      'asyncThrottle',
      'batch',
      'debounce',
      'queue',
      'rateLimit',
      'react-query-debounced-prefetch',
      'react-query-queued-prefetch',
      'react-query-throttled-prefetch',
      'throttle',
      'useAsyncBatchedCallback',
      'useAsyncBatcher',
      'useAsyncDebouncedCallback',
      'useAsyncDebouncer',
      'useAsyncQueuer',
      'useAsyncRateLimiter',
      'useAsyncThrottledCallback',
      'useAsyncThrottler',
      'useBatchedCallback',
      'useBatcher',
      'useDebouncedCallback',
      'useDebouncedState',
      'useDebouncedValue',
      'useDebouncer',
      'useQueuedValue',
      'useQueuer',
      'useRateLimitedCallback',
      'useRateLimitedValue',
      'useRateLimiter',
      'useThrottledCallback',
      'useThrottledState',
      'useThrottledValue',
      'useThrottler',
    ],
  }),
  ...clientExamples({
    entry: '/src/index.ts',
    framework: 'vanilla',
    libraryId: 'pacer',
    slugs: [
      'LiteBatcher',
      'LiteDebouncer',
      'LiteQueuer',
      'LiteRateLimiter',
      'LiteThrottler',
      'liteBatch',
      'liteDebounce',
      'liteQueue',
      'liteRateLimit',
      'liteThrottle',
    ],
  }),
  ...clientExamples({
    entry: '/src/index.tsx',
    framework: 'react',
    libraryId: 'hotkeys',
    slugs: [
      'useHeldKeys',
      'useHotkeyRecorder',
      'useHotkeySequence',
      'useHotkeySequenceRecorder',
      'useHotkeySequences',
      'useHotkeys',
      'useKeyhold',
    ],
  }),
  ...clientExamples({
    entry: '/src/main.tsx',
    framework: 'react',
    libraryId: 'ranger',
    slugs: [
      'basic',
      'custom-steps',
      'custom-styles',
      'logarithmic-interpolator',
      'update-on-drag',
    ],
  }),
  ...clientExamples({
    entry: '/src/index.tsx',
    framework: 'react',
    libraryId: 'query',
    slugs: ['algolia', 'devtools-panel', 'playground', 'simple'],
  }),
  {
    entry: '/src/main.tsx',
    framework: 'react',
    libraryId: 'query',
    slug: 'shadow-dom',
  },
  ...clientExamples({
    entry: '/src/index.tsx',
    framework: 'react',
    libraryId: 'form',
    slugs: [
      'composition',
      'devtools',
      'dynamic',
      'field-errors-from-form-validators',
      'multi-step-wizard',
      'query-integration',
      'simple',
      'standard-schema',
    ],
  }),
  ...clientExamples({
    entry: '/src/main.tsx',
    framework: 'react',
    libraryId: 'table',
    slugs: [
      'aggregation',
      'basic-dynamic-columns',
      'basic-external-atoms',
      'basic-external-state',
      'basic-subscribe',
      'basic-use-app-table',
      'basic-use-table',
      'cell-spanning',
      'column-dnd',
      'column-ordering',
      'column-pinning',
      'column-pinning-split',
      'column-pinning-sticky',
      'column-resizing',
      'column-resizing-performant',
      'column-sizing',
      'column-visibility',
      'custom-plugin',
      'expanding',
      'filters',
      'filters-faceted',
      'filters-faceted-bucketed',
      'filters-fuzzy',
      'grouped-aggregation',
      'grouping',
      'header-groups',
      'lib-chakra-ui',
      'lib-material-ui',
      'pagination',
      'row-dnd',
      'row-pinning',
      'row-selection',
      'sorting',
      'sub-components',
      'virtualized-columns',
      'virtualized-columns-experimental',
      'virtualized-infinite-scrolling',
      'virtualized-rows',
      'virtualized-rows-experimental',
      'with-tanstack-query',
    ],
  }),
  ...clientExamples({
    entry: '/src/main.ts',
    framework: 'vanilla',
    libraryId: 'table',
    slugs: ['aggregation', 'basic', 'pagination', 'sorting'],
  }),
  {
    entry: '/src/main.tsx',
    framework: 'react',
    libraryId: 'db',
    slug: 'paced-mutations-demo',
  },
  {
    autoStart: true,
    entry: '/src/routes/index.tsx',
    framework: 'react',
    libraryId: 'router',
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    slug: 'basic-ssr-file-based',
  },
  {
    autoStart: true,
    entry: '/src/routes/index.tsx',
    framework: 'react',
    libraryId: 'start',
    runtime: {
      type: 'webcontainer',
      compatibility: 'tanstack-start-async-context',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    slug: 'start-counter',
  },
  {
    autoStart: true,
    entry: '/src/routes/index.tsx',
    framework: 'react',
    libraryId: 'start',
    runtime: {
      type: 'webcontainer',
      compatibility: 'tanstack-start-async-context',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    slug: 'start-basic',
  },
  {
    autoStart: true,
    entry: '/src/routes/index.tsx',
    framework: 'react',
    libraryId: 'start',
    runtime: {
      type: 'webcontainer',
      compatibility: 'tanstack-start-async-context',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    slug: 'start-streaming-data-from-server-functions',
  },
]

export function getClientExampleConfig({
  framework,
  libraryId,
  slug,
  version,
}: {
  framework: string
  libraryId: string
  slug: string
  version: string
}) {
  if (version !== 'latest') return undefined

  return clientExampleConfigs.find(
    (config) =>
      config.libraryId === libraryId &&
      config.framework === framework &&
      config.slug === slug,
  )
}
