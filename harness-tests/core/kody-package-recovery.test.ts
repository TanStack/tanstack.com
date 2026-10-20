import { describe, expect, it, vi } from 'vitest'
import { readFailedKodyPackageDocumentation } from '../../src/chat/server/kody-package-recovery'

const packageId = '149fd608-2ec1-4da1-9d93-f85816d74ccc'
const otherPackageId = '9faee978-8a5d-4d97-84e4-546ff2ef7b8b'
const action = `package:${packageId}#./list-conversations`
const document = `package:${packageId}#README.md`
const index = (overrides: Record<string, unknown> = {}) => ({
  structuredContent: {
    result: {
      kind: 'entity',
      type: 'package',
      detailMode: 'index',
      packageId,
      kodyId: 'slack',
      name: '@tannerlinsley/slack',
      readmeIntent: { path: 'README.md' },
      ...overrides,
    },
  },
})
const file = (overrides: Record<string, unknown> = {}) => ({
  structuredContent: {
    result: {
      kind: 'entity',
      type: 'package',
      detailMode: 'file',
      packageId,
      path: 'README.md',
      content: 'Fork the package, then connect at https://example.com/setup.',
      truncated: false,
      ...overrides,
    },
  },
})

describe('failed Kody package documentation', () => {
  it('reads only the package index and its declared setup document by exact ID', async () => {
    const search = vi.fn(async (entity: string) =>
      entity === `package:${packageId}` ? index() : file(),
    )
    expect(await readFailedKodyPackageDocumentation(action, search)).toEqual({
      entity: document,
      content: 'Fork the package, then connect at https://example.com/setup.',
      excerpted: false,
    })
    expect(search.mock.calls.map(([entity]) => entity)).toEqual([
      `package:${packageId}`,
      document,
    ])
  })

  it('does not read an undeclared path or accept another package’s file', async () => {
    const unsafe = vi.fn(async () =>
      index({ readmeIntent: { path: '../private.txt' } }),
    )
    expect(await readFailedKodyPackageDocumentation(action, unsafe)).toBeNull()
    expect(unsafe).toHaveBeenCalledTimes(1)

    const swapped = vi.fn(async (entity: string) =>
      entity === `package:${packageId}`
        ? index()
        : file({ packageId: otherPackageId }),
    )
    expect(await readFailedKodyPackageDocumentation(action, swapped)).toBeNull()
  })

  it('does not fetch a document for a capability, index, or changed package identity', async () => {
    const search = vi.fn(async () => index({ packageId: otherPackageId }))
    for (const entity of [
      'capability:metaGetCurrentUser',
      `package:${packageId}`,
      action,
    ])
      expect(
        await readFailedKodyPackageDocumentation(entity, search),
      ).toBeNull()
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('bounds long documents and marks incomplete evidence', async () => {
    const search = vi.fn(async (entity: string) =>
      entity === `package:${packageId}`
        ? index()
        : file({ content: 'x'.repeat(12000) }),
    )
    const result = await readFailedKodyPackageDocumentation(action, search)
    expect(result?.content).toHaveLength(10000)
    expect(result?.excerpted).toBe(true)
  })
})
