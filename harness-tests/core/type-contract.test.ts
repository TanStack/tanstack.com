import { expect, it } from 'vitest'
import { Validator } from '@cfworker/json-schema'
import {
  typeContractToSchema,
  functionContractToSchema,
  UnsupportedTypeContract,
} from '../../src/chat/server/type-contract'

it('converts actual capability metadata without loosening enum or optional fields', () => {
  const schema = typeContractToSchema(`type EmailMessageListInput = {
    inbox_id?: string
    direction?: "inbound" | "outbound"
    limit?: number
  }`)
  const validator = new Validator(schema)
  expect(validator.validate({}).valid).toBe(true)
  expect(validator.validate({ direction: 'inbound', limit: 10 }).valid).toBe(
    true,
  )
  expect(validator.validate({ direction: 'other' }).valid).toBe(false)
  expect(validator.validate({ limit: 'ten' }).valid).toBe(false)
  expect(validator.validate({ invented: true }).valid).toBe(false)
})
it('resolves aliases, interfaces, nullable arrays, and required fields', () => {
  const schema = typeContractToSchema(
    `
    type Item = { id: string; active: boolean }
    export interface Input { items: Array<Item>; cursor?: string | null }
  `,
    'Input',
  )
  const validator = new Validator(schema)
  expect(
    validator.validate({ items: [{ id: 'a', active: true }], cursor: null })
      .valid,
  ).toBe(true)
  expect(validator.validate({ items: [{ id: 'a' }] }).valid).toBe(false)
  expect(validator.validate({}).valid).toBe(false)
})
it.each([
  'type Input = any',
  'type Input = Unknown',
  'type Input = { next: Input }',
  'type Input<T> = { value: T }',
  'type Input = { [key: string]: string }',
  'type Input = { action(): void }',
  'type Input = string; console.log("never execute")',
  'interface Input extends Other {}',
  'type Input = { value: string | undefined }',
])('rejects unsupported contracts instead of widening them: %s', (source) => {
  expect(() => typeContractToSchema(source)).toThrow(UnsupportedTypeContract)
})

it('extracts declared function parameters and preserves their calling order', async () => {
  const { functionContractToSchema } =
    await import('../../src/chat/server/type-contract')
  const contract = functionContractToSchema(
    'export declare function listEvents(calendarId: string, options?: Options): Promise<string[]>',
    ['type Options = { limit?: number; cursor?: string | null }'],
  )
  expect(contract.parameterOrder).toEqual(['calendarId', 'options'])
  const validator = new Validator(contract.inputSchema)
  expect(validator.validate({ calendarId: 'abc' }).valid).toBe(true)
  expect(validator.validate({ options: {} }).valid).toBe(false)
  expect(
    validator.validate({ calendarId: 'abc', options: { limit: 'ten' } }).valid,
  ).toBe(false)
  expect(() =>
    functionContractToSchema('export function run() { throw new Error() }'),
  ).toThrow(UnsupportedTypeContract)
  expect(() =>
    functionContractToSchema('declare function run(...args: string[]): void'),
  ).toThrow(UnsupportedTypeContract)
})

it('keeps a live open-ended package signature unresolved instead of inventing fields', async () => {
  const { functionContractToSchema } =
    await import('../../src/chat/server/type-contract')
  expect(() =>
    functionContractToSchema(
      'export default async function getHistory(params: Record<string, unknown>)',
    ),
  ).toThrow('unsupported generic reference')
})

it('treats declared default parameters as optional without evaluating their defaults', () => {
  const result = functionContractToSchema(
    'export default async function list(params: { limit?: number; cursor?: string } = {})',
  )
  expect(result.parameterOrder).toEqual(['params'])
  expect(result.inputSchema.required).toEqual([])
  expect(
    (result.inputSchema.properties as any).params.properties.limit,
  ).toEqual({ type: 'number' })
})

it('does not run a default initializer from untrusted type metadata', () => {
  const result = functionContractToSchema(
    'declare function run(options: { value?: string } = (() => { throw new Error("must not execute") })()): void',
  )
  expect(result.inputSchema.required).toEqual([])
})

it('recognizes an empty record contract without allowing arbitrary record fields', () => {
  const validator = new Validator(
    typeContractToSchema('type Input = Record<string, never>'),
  )
  expect(validator.validate({}).valid).toBe(true)
  expect(validator.validate({ invented: 'value' }).valid).toBe(false)
  expect(validator.validate([]).valid).toBe(false)
  expect(() =>
    typeContractToSchema('type Input = Record<string, unknown>'),
  ).toThrow(UnsupportedTypeContract)
  expect(() =>
    typeContractToSchema('type Input = Record<string, string>'),
  ).toThrow(UnsupportedTypeContract)
  expect(() =>
    typeContractToSchema(
      'type Record = string; type Input = Record<string, never>',
      'Input',
    ),
  ).toThrow(UnsupportedTypeContract)
})
