import { extractMarkdownSearchSections } from '../src/utils/markdown/searchExtraction'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

function assertDeepEqual(
  actual: Array<string>,
  expected: Array<string>,
  message: string,
) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`)
  }
}

function assertMatch(value: string, pattern: RegExp, message: string) {
  if (!pattern.test(value)) {
    throw new Error(`${message}: ${pattern} did not match ${value}`)
  }
}

function assertDoesNotMatch(value: string, pattern: RegExp, message: string) {
  if (pattern.test(value)) {
    throw new Error(`${message}: ${pattern} matched ${value}`)
  }
}

const frameworkMarkdown = `
# Adapter guide

Shared setup applies to every framework.

<!-- ::start:framework -->

# React

React adapter only.

## Client setup

Use React hooks.

# Solid

Solid adapter only.

## Client setup

Use Solid signals.

<!-- ::end:framework -->
`

const frameworkResult =
  await extractMarkdownSearchSections(frameworkMarkdown)
const sharedFrameworkText = frameworkResult.sections
  .filter((section) => section.framework === 'all')
  .map((section) => section.content)
  .join(' ')
const reactFrameworkText = frameworkResult.sections
  .filter((section) => section.framework === 'react')
  .map((section) => section.content)
  .join(' ')
const solidFrameworkText = frameworkResult.sections
  .filter((section) => section.framework === 'solid')
  .map((section) => section.content)
  .join(' ')

assertMatch(sharedFrameworkText, /Shared setup/, 'shared text indexed')
assertMatch(reactFrameworkText, /React adapter only/, 'react text indexed')
assertMatch(reactFrameworkText, /Use React hooks/, 'react heading content indexed')
assertDoesNotMatch(
  reactFrameworkText,
  /Solid adapter only/,
  'solid content excluded from react section',
)
assertMatch(solidFrameworkText, /Solid adapter only/, 'solid text indexed')
assertMatch(solidFrameworkText, /Use Solid signals/, 'solid heading content indexed')
assertDoesNotMatch(
  solidFrameworkText,
  /React adapter only/,
  'react content excluded from solid section',
)
assertDeepEqual(
  frameworkResult.frameworks,
  ['all', 'react', 'solid'],
  'framework list preserved',
)

const packageManagerMarkdown = `
# Install

<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

react: @tanstack/react-query @tanstack/react-query-devtools
solid: @tanstack/solid-query

<!-- ::end:tabs -->
`

const packageManagerResult = await extractMarkdownSearchSections(
  packageManagerMarkdown,
)
const reactInstall = packageManagerResult.sections.find(
  (section) => section.framework === 'react',
)
const solidInstall = packageManagerResult.sections.find(
  (section) => section.framework === 'solid',
)

assertEqual(reactInstall?.anchor, 'install', 'install anchor captured')
assertEqual(reactInstall?.heading, 'Install', 'install heading captured')
assertMatch(
  reactInstall?.content ?? '',
  /npm i -D @tanstack\/react-query @tanstack\/react-query-devtools/,
  'react install command generated',
)
assertMatch(
  solidInstall?.content ?? '',
  /npm i -D @tanstack\/solid-query/,
  'solid install command generated',
)
assertDoesNotMatch(
  reactInstall?.content ?? '',
  /react:/,
  'react raw package marker removed',
)
assertDoesNotMatch(
  solidInstall?.content ?? '',
  /solid:/,
  'solid raw package marker removed',
)

const tabsMarkdown = `
# Examples

<!-- ::start:tabs variant="files" -->

\`\`\`tsx title="app.tsx"
export const app = true
\`\`\`

\`\`\`css title="styles.css"
.root {
  color: tomato;
}
\`\`\`

<!-- ::end:tabs -->

<!-- ::start:tabs -->

## Alpha

Alpha tab content.

## Beta

Beta tab content.

<!-- ::end:tabs -->
`

const tabsResult = await extractMarkdownSearchSections(tabsMarkdown)
const tabsText = tabsResult.sections
  .map((section) => section.content)
  .join(' ')

assertMatch(tabsText, /app\.tsx/, 'file tab name indexed')
assertMatch(tabsText, /export const app = true/, 'file tab code indexed')
assertMatch(tabsText, /styles\.css/, 'second file tab name indexed')
assertMatch(tabsText, /color: tomato/, 'second file tab code indexed')
assertMatch(tabsText, /Alpha/, 'default tab name indexed')
assertMatch(tabsText, /Alpha tab content/, 'default tab content indexed')
assertMatch(tabsText, /Beta/, 'second default tab name indexed')
assertMatch(tabsText, /Beta tab content/, 'second default tab content indexed')
assertDoesNotMatch(tabsText, /::start:tabs/, 'raw start marker removed')
assertDoesNotMatch(tabsText, /::end:tabs/, 'raw end marker removed')

const headingMarkdown = `
## Search Params

Heading anchors should survive extraction.
`

const headingResult = await extractMarkdownSearchSections(headingMarkdown)
const headingSection = headingResult.sections.find(
  (section) => section.heading === 'Search Params',
)

assertEqual(headingSection?.anchor, 'search-params', 'heading anchor captured')
assertEqual(headingSection?.level, 2, 'heading level captured')
assertMatch(
  headingSection?.content ?? '',
  /Heading anchors/,
  'heading content captured',
)

console.log('markdown-search-extraction tests passed')
