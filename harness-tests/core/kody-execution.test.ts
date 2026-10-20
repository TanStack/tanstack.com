import { expect, it } from 'vitest'
import { validateKodyExecution } from '../../src/chat/server/kody-actions'

it('rejects unsupported literal Kody dynamic imports before approval', () => {
  expect(() =>
    validateKodyExecution(
      'export default async function main() { return import("kody:@example/tasks/list") }',
    ),
  ).toThrow('top-level static import')
})

it('allows static Kody imports and data-driven dynamic imports', () => {
  expect(() =>
    validateKodyExecution(
      'import action from "kody:@example/tasks/list"; export default async function main(specifier) { return [await action({}), await import(specifier)] }',
    ),
  ).not.toThrow()
})

it('rejects exporting a call result before approval or execution', () => {
  expect(() =>
    validateKodyExecution(
      'import action from "kody:@example/tasks/list"; export default action()',
    ),
  ).toThrow('default export a function')
})
it.each([
  'export default async function main(params) { return await action(params) }',
  'export default async (params) => action(params)',
])('accepts an executable function: %s', (code) => {
  expect(() => validateKodyExecution(code)).not.toThrow()
})
it.each([
  'export default {}',
  'const main = () => 1',
  'export default async function {',
])('rejects invalid modules: %s', (code) => {
  expect(() => validateKodyExecution(code)).toThrow()
})
