import {
  buildSearchRecordsForMarkdown,
  isExcludedFromSearchIndex,
} from '../src/utils/searchIndexGeneration'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

function assertTruthy(value: unknown, message: string) {
  if (!value) {
    throw new Error(message)
  }
}

function assertMatch(value: string, pattern: RegExp, message: string) {
  if (!pattern.test(value)) {
    throw new Error(`${message}: ${pattern} did not match ${value}`)
  }
}

function assertDoesNotInclude(
  values: Array<string>,
  expected: string,
  message: string,
) {
  if (values.includes(expected)) {
    throw new Error(`${message}: found ${expected}`)
  }
}

const formLibrary: { id: 'form'; name: string } = {
  id: 'form',
  name: 'TanStack Form',
}

const canonicalRecords = await buildSearchRecordsForMarkdown({
  library: formLibrary,
  version: 'latest',
  docsPath: 'overview',
  title: 'Overview',
  content: `
Shared overview content.

<!-- ::start:framework -->

# React

React-only canonical content.

## Validation

React validation content.

# Solid

Solid-only canonical content.

## Validation

Solid validation content.

<!-- ::end:framework -->
`,
})

const canonicalFrameworks = canonicalRecords.map((record) => record.framework)
assertTruthy(
  canonicalFrameworks.includes('all'),
  'canonical shared record should be framework all',
)
assertTruthy(
  canonicalFrameworks.includes('react'),
  'canonical framework block should emit react record',
)
assertTruthy(
  canonicalFrameworks.includes('solid'),
  'canonical framework block should emit solid record',
)

const reactValidationRecord = canonicalRecords.find(
  (record) =>
    record.framework === 'react' && record.hierarchy.lvl2 === 'Validation',
)
assertTruthy(reactValidationRecord, 'react validation record should exist')
assertEqual(
  reactValidationRecord?.routeStyle,
  'canonical',
  'canonical route style preserved',
)
assertEqual(
  reactValidationRecord?.url,
  'https://tanstack.com/form/latest/docs/overview',
  'canonical URL preserved',
)
assertEqual(
  reactValidationRecord?.urlWithAnchor,
  'https://tanstack.com/form/latest/docs/overview#validation',
  'canonical URL anchor preserved',
)
assertMatch(
  reactValidationRecord?.content ?? '',
  /React validation content/,
  'react content indexed',
)

const routerLibrary: { id: 'router'; name: string } = {
  id: 'router',
  name: 'TanStack Router',
}

const frameworkPathRecords = await buildSearchRecordsForMarkdown({
  library: routerLibrary,
  version: 'latest',
  docsPath: 'framework/react/quick-start',
  title: 'Quick Start',
  content: `
React quick-start content.

## Install

Install the React adapter.

<!-- ::start:framework -->

# React

React nested content.

# Solid

Solid nested content should not index for the React path.

<!-- ::end:framework -->
`,
})

assertTruthy(frameworkPathRecords.length > 0, 'framework path records emitted')
for (const record of frameworkPathRecords) {
  assertEqual(record.framework, 'react', 'framework path scoped to URL framework')
  assertEqual(
    record.routeStyle,
    'framework-path',
    'framework path route style preserved',
  )
  assertEqual(
    record.url.startsWith(
      'https://tanstack.com/router/latest/docs/framework/react/quick-start',
    ),
    true,
    'framework path URL preserved',
  )
}

const frameworkPathText = frameworkPathRecords
  .map((record) => record.content ?? '')
  .join(' ')
assertMatch(frameworkPathText, /React nested content/, 'react nested text indexed')
assertDoesNotInclude(
  frameworkPathRecords.map((record) => record.framework),
  'solid',
  'solid framework not emitted for react framework path',
)
assertEqual(
  isExcludedFromSearchIndex(
    'https://tanstack.com/intent/registry?tab=packages',
  ),
  true,
  'registry query URL excluded',
)
assertEqual(
  isExcludedFromSearchIndex('https://tanstack.com/intent/registry/pkg/SKILL'),
  true,
  'registry path URL excluded',
)
assertEqual(
  isExcludedFromSearchIndex('https://tanstack.com/intent/latest/docs/registry'),
  false,
  'intent docs registry page remains indexable',
)

console.log('search-index-generation tests passed')
