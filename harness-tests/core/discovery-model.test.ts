import { describe, it, expect } from 'vitest'
import { discoveryProviderSchema } from '../../src/chat/server/discovery-model'
describe('Workers AI discovery schemas', () => {
  it('removes only redundant string-key constraints without changing the source contract', () => {
    const schema = {
      type: 'object',
      propertyNames: { type: 'string' },
      properties: {
        nested: {
          type: 'object',
          propertyNames: { type: 'string', pattern: '^safe' },
        },
      },
    }
    const result = discoveryProviderSchema(schema)
    expect(result).not.toHaveProperty('propertyNames')
    expect(result.properties.nested.propertyNames).toEqual({
      type: 'string',
      pattern: '^safe',
    })
    expect(schema.propertyNames).toEqual({ type: 'string' })
  })
  it('preserves actual properties and data named propertyNames', () => {
    const schema = {
      type: 'object',
      properties: { propertyNames: { type: 'string' } },
      const: { propertyNames: { type: 'string' } },
    }
    expect(discoveryProviderSchema(schema)).toEqual(schema)
  })
})
