import {
  extractFrameworksFromMarkdown,
  filterFrameworkContent,
} from '../src/utils/markdown/filterFrameworkContent'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, got ${actualJson}`)
  }
}

const frameworkBlockMarkdown = `
Shared content.

<!-- ::start:framework -->

# React

React content.

# Solid

Solid content.

# Vue

Vue content.

<!-- ::end:framework -->
`

assertEqual(
  extractFrameworksFromMarkdown(frameworkBlockMarkdown),
  ['react', 'solid', 'vue'],
  'framework block frameworks extracted',
)

const packageManagerMarkdown = `
<!-- ::start:tabs variant="package-manager" mode="install" -->
react: @tanstack/react-query
solid: @tanstack/solid-query
react: @tanstack/react-query-devtools
<!-- ::end:tabs -->
`

assertEqual(
  extractFrameworksFromMarkdown(packageManagerMarkdown),
  ['react', 'solid'],
  'package manager frameworks extracted and deduped',
)

const mixedMarkdown = `
<!-- ::start:framework -->
# Svelte
Svelte content.
# React
React content.
<!-- ::end:framework -->

<!-- ::start:tabs variant="package-managers" mode="install" -->
vue: @tanstack/vue-form
svelte: @tanstack/svelte-form
<!-- ::end:tabs -->
`

assertEqual(
  extractFrameworksFromMarkdown(mixedMarkdown),
  ['svelte', 'react', 'vue'],
  'mixed framework sources preserve first-seen order',
)

const sharedCommands = `<!-- ::start:tabs variant="package-manager" mode="local-install" -->
@tanstack/intent@latest list
@tanstack/intent@latest validate
@tanstack/intent@latest review
<!-- ::end:tabs -->`

for (const framework of [
  undefined,
  'react',
  'solid',
  'vue',
  'svelte',
  'angular',
  'lit',
]) {
  for (const [packageManager, runner] of [
    ['npm', 'npx'],
    ['pnpm', 'pnpx'],
    ['yarn', 'yarn dlx'],
    ['bun', 'bunx'],
  ] as const) {
    assertEqual(
      filterFrameworkContent(sharedCommands, { framework, packageManager }),
      `\`\`\`sh\n${runner} @tanstack/intent@latest list\n${runner} @tanstack/intent@latest validate\n${runner} @tanstack/intent@latest review\n\`\`\``,
      `three shared commands for ${framework ?? 'no framework'} and ${packageManager}`,
    )
  }
}

assertEqual(
  extractFrameworksFromMarkdown(sharedCommands),
  [],
  'shared commands do not advertise framework variants',
)

const mixedCommands = `<!-- ::start:tabs variant="package-manager" mode="local-install" -->
react: react-only
shared-first
solid: solid-only
shared-last
<!-- ::end:tabs -->`

for (const [framework, commands] of [
  [undefined, ['shared-first', 'shared-last']],
  ['react', ['react-only', 'shared-first', 'shared-last']],
  ['solid', ['shared-first', 'solid-only', 'shared-last']],
  ['another-framework', ['shared-first', 'shared-last']],
] as const) {
  assertEqual(
    filterFrameworkContent(mixedCommands, { framework, packageManager: 'npm' }),
    `\`\`\`sh\n${commands.map((command) => `npx ${command}`).join('\n')}\n\`\`\``,
    `shared and framework commands preserve source order for ${framework ?? 'no framework'}`,
  )
}

assertEqual(
  extractFrameworksFromMarkdown(mixedCommands),
  ['react', 'solid'],
  'only explicit framework variants are advertised',
)
assertEqual(
  filterFrameworkContent(sharedCommands, { framework: 'react' }),
  sharedCommands,
  'commands stay unchanged without a selected package manager',
)
assertEqual(
  filterFrameworkContent(packageManagerMarkdown, { packageManager: 'npm' }),
  packageManagerMarkdown,
  'framework-specific blocks stay unchanged without a selected framework',
)
assertEqual(
  filterFrameworkContent(sharedCommands, {
    packageManager: 'npm',
    keepMarkers: true,
  }),
  `<!-- ::start:tabs variant="package-manager" mode="local-install" -->
\`\`\`sh
npx @tanstack/intent@latest list
npx @tanstack/intent@latest validate
npx @tanstack/intent@latest review
\`\`\`
<!-- ::end:tabs -->`,
  'shared commands preserve requested markers',
)

const literalCommands = `<!-- ::start:tabs variant="package-manager" mode="local-install" -->
\`\`\`text
@tanstack/intent@latest load <package>#<skill>
@tanstack/intent@latest exclude add package#experimental-*
@tanstack/intent@latest review --base main > .intent/review.json
tool --registry https://registry.example.com --filter name:value
\`\`\`
<!-- ::end:tabs -->`

assertEqual(
  filterFrameworkContent(literalCommands, { packageManager: 'npm' }),
  `\`\`\`sh
npx @tanstack/intent@latest load <package>#<skill>
npx @tanstack/intent@latest exclude add package#experimental-*
npx @tanstack/intent@latest review --base main > .intent/review.json
npx tool --registry https://registry.example.com --filter name:value
\`\`\``,
  'literal command arguments survive Markdown export',
)
assertEqual(
  extractFrameworksFromMarkdown(literalCommands),
  [],
  'colons in arguments do not become framework variants',
)

console.log('filter-framework-content tests passed')
