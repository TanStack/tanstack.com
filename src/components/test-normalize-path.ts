// Test suite for markdown link path normalization
// This can be run with: npx tsx src/components/test-normalize-path.ts

import { normalizeMarkdownPath } from '../utils/normalize-markdown-path'

// Test cases
const testCases: Array<[string, string, string]> = [
  // [input, expected, description]
  
  // Paths that should be modified
  ['./foo', '../foo', 'Same directory with ./'],
  ['./guides/foo', '../guides/foo', 'Subdirectory with ./'],
  ['./overview.md#api-reference', '../overview.md#api-reference', 'Same directory with ./ and hash'],
  ['./installation.md', '../installation.md', 'Real example from quick-start.md'],
  ['./overview.md', '../overview.md', 'Real example from quick-start.md'],
  ['./live-queries.md', '../live-queries.md', 'Real example from quick-start.md'],
  ['foo', '../foo', 'Bare filename (same directory)'],
  ['guides/foo', '../guides/foo', 'Bare subdirectory path'],
  ['guides/subfolder/foo', '../guides/subfolder/foo', 'Nested bare path'],
  ['live-queries.md', '../live-queries.md', 'Real bare filename from overview.md'],
  
  // Paths that should NOT be modified (from real DB docs)
  ['../foo', '../foo', 'Already has ../'],
  ['../classes/foo', '../classes/foo', 'Already has ../ with subdirectory'],
  ['../classes/aggregatefunctionnotinselecterror.md', '../classes/aggregatefunctionnotinselecterror.md', 'Real example from reference docs'],
  ['../interfaces/btreeindexoptions.md', '../interfaces/btreeindexoptions.md', 'Real example from reference docs'],
  ['../type-aliases/changelistener.md', '../type-aliases/changelistener.md', 'Real example from reference docs'],
  ['../../foo', '../../foo', 'Multiple ../'],
  ['/absolute/path', '/absolute/path', 'Absolute path'],
  ['http://example.com', 'http://example.com', 'HTTP URL'],
  ['https://example.com', 'https://example.com', 'HTTPS URL'],
  ['https://github.com/TanStack/db/blob/main/packages/db/src/types.ts#L228', 'https://github.com/TanStack/db/blob/main/packages/db/src/types.ts#L228', 'GitHub source link'],
  
  // Real examples from TanStack Router docs
  ['../learn-the-basics.md', '../learn-the-basics.md', 'Router: Parent directory link'],
  ['../hosting.md', '../hosting.md', 'Router: Parent directory hosting guide'],
  ['../server-functions.md', '../server-functions.md', 'Router: Parent directory server functions'],
  ['../server-routes.md', '../server-routes.md', 'Router: Parent directory server routes'],
  ['../middleware.md', '../middleware.md', 'Router: Parent directory middleware'],
]

// Run tests
console.log('Running path normalization tests:\n')
let passed = 0
let failed = 0

for (const [input, expected, description] of testCases) {
  const result = normalizeMarkdownPath(input)
  const isPass = result === expected
  
  if (isPass) {
    console.log(`✅ PASS: ${description}`)
    console.log(`   Input: "${input}" → Output: "${result}"`)
    passed++
  } else {
    console.log(`❌ FAIL: ${description}`)
    console.log(`   Input: "${input}"`)
    console.log(`   Expected: "${expected}"`)
    console.log(`   Got: "${result}"`)
    failed++
  }
  console.log('')
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)

// Edge cases to consider
console.log('\n--- Edge Cases to Consider ---')
console.log('1. Hash fragments: "foo#section" should become "../foo#section"')
console.log('2. Query params: "foo?param=value" should become "../foo?param=value"')
console.log('3. Special protocols: "mailto:", "javascript:", etc. should not be modified')
console.log('4. Empty string or undefined should return as-is')

// Test edge cases
console.log('\n--- Testing Edge Cases ---\n')

const edgeCases: Array<[string | undefined, string | undefined, string]> = [
  ['foo#section', '../foo#section', 'Hash fragment'],
  ['./foo#section', '../foo#section', 'With ./ and hash'],
  ['../foo#section', '../foo#section', 'Already ../ with hash'],
  [undefined, undefined, 'Undefined input'],
  ['', '', 'Empty string'],
  ['#section', '#section', 'Hash only (should not be modified)'],
  ['mailto:test@example.com', 'mailto:test@example.com', 'Mailto protocol'],
  ['javascript:void(0)', 'javascript:void(0)', 'Javascript protocol'],
]

for (const [input, expected, description] of edgeCases) {
  const result = normalizeMarkdownPath(input)
  const isPass = result === expected
  
  if (isPass) {
    console.log(`✅ PASS: ${description}`)
    console.log(`   Input: "${input}" → Output: "${result}"`)
  } else {
    console.log(`❌ FAIL: ${description}`)
    console.log(`   Input: "${input}"`)
    console.log(`   Expected: "${expected}"`)
    console.log(`   Got: "${result}"`)
  }
  console.log('')
}

