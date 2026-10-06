import { describe, it, expect, vi } from 'vitest'
import { kodyDiscovery } from '../../src/chat/server/discovery-integrations/kody'
import { discoveryIntegration } from '../../src/chat/server/discovery-integrations'
import {
  responseShape,
  UnsupportedDiscoveryShape,
} from '../../src/chat/server/discovery-integrations/contract'
import {
  discoverRecursively,
  type DiscoveryDependencies,
} from '../../src/chat/server/mcp-discovery'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'

// Reduced, non-personal fixtures matching live Kody search responses.
const match = {
  type: 'capability',
  id: 'codingGuideGet',
  title: 'codingGuideGet',
  entityRef: 'capability:codingGuideGet',
  description: 'Load a guide',
  usage: 'execute with kody.codingGuideGet(args)',
}
const wrap = (result: unknown) => ({
  isError: false,
  structuredContent: { result },
})
const listing = wrap({ matches: [match] })
const detail = wrap({
  ...match,
  kind: 'entity',
  executeExample: 'kody.codingGuideGet(args)',
  inputTypeDefinition: 'type Input = { guide: string }',
})
const root: CatalogEntry = {
  id: 'root',
  serverId: 'test',
  serverLabel: 'Test',
  kind: 'tool',
  name: 'search',
  title: 'Search',
  description: 'Find capabilities',
  target: { method: 'tools/call', name: 'search' },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      entity: { type: 'string' },
      domain: { type: 'string' },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}
function dependencies(): DiscoveryDependencies {
  return {
    signal: new AbortController().signal,
    trustedServers: new Set(['test']),
    integrationFor: () => kodyDiscovery,
    choose: vi.fn<DiscoveryDependencies['choose']>(async (entries) =>
      entries.map((entry) => entry.id),
    ),
    interpret: vi.fn(async () => ({
      message: 'Read metadata',
      capabilities: [],
      next: [
        {
          entryId: 'root',
          arguments: { query: 'guides' },
          purpose: 'Discover guides',
        },
      ],
    })),
    invoke: vi.fn().mockResolvedValueOnce(listing).mockResolvedValue(detail),
  }
}
describe('paired discovery integrations', () => {
  it('requires explicit pairing, not a familiar tool name', () => {
    expect(discoveryIntegration(undefined)).toBeUndefined()
    expect(discoveryIntegration('kody')).toBe(kodyDiscovery)
    expect(kodyDiscovery.supports({ ...root, name: 'execute' })).toBe(false)
  })
  it('preserves returned refs instead of constructing them', () => {
    const page = kodyDiscovery.parse(listing)
    expect(page.entries[0].next?.arguments).toEqual({
      entity: 'capability:codingGuideGet',
    })
    expect(page.coverage).toBe('partial')
    const reversed = kodyDiscovery.parse(
      wrap({ matches: [{ ...match, entityRef: 'codingGuideGet:capability' }] }),
    )
    expect(reversed.entries[0].next?.arguments.entity).toBe(
      'codingGuideGet:capability',
    )
  })
  it('distinguishes domain branches from capabilities and keeps types as documentation', () => {
    const domain = kodyDiscovery.parse(
      wrap({
        matches: [{ type: 'domain', id: 'coding', description: 'Guides' }],
      }),
    ).entries[0]
    expect(domain.kind).toBe('group')
    expect(domain.next?.arguments).toEqual({ domain: 'coding' })
    const item = kodyDiscovery.parse(detail).entries[0]
    expect(item.invocation).toContain('type Input')
    expect(item.next).toBeUndefined()
  })
  it.each([
    wrap({ unknown: [] }),
    wrap({ matches: [{ ...match, entityRef: undefined }] }),
    { ...listing, isError: true },
    wrap({ matches: [match, { type: 'new-kind', id: 'x' }] }),
    wrap({ kind: 'entity', type: 'package', id: 'x', entityRef: 'package:x' }),
  ])('rejects unknown or incomplete shapes atomically', (raw) => {
    expect(() => kodyDiscovery.parse(raw)).toThrow(UnsupportedDiscoveryShape)
  })
  it('decodes and follows known formats without model response parsing', async () => {
    const d = dependencies()
    const result = await discoverRecursively([root], 'guides', d)
    expect(result.calls).toBe(2)
    expect(d.interpret).not.toHaveBeenCalled()
    expect(d.invoke).toHaveBeenLastCalledWith(root, {
      entity: 'capability:codingGuideGet',
    })
    expect(result.candidates).toHaveLength(2) // Stable identity replaces the summary.
    expect(result.candidates[1].discovered?.invocation).toContain('type Input')
    expect(result.diagnostics).toEqual([])
  })
  it('records gaps before fallback, even if the fallback fails', async () => {
    const d = dependencies()
    d.invoke = vi.fn(async () => wrap({ newShape: 'private-value' }))
    d.onDiagnostic = vi.fn(async () => {})
    d.interpret = vi.fn().mockRejectedValueOnce(new Error('Model unavailable'))
    await expect(discoverRecursively([root], 'guides', d)).rejects.toThrow(
      'Model unavailable',
    )
    expect(d.onDiagnostic).toHaveBeenCalledOnce()
    const logged = JSON.stringify(vi.mocked(d.onDiagnostic!).mock.calls)
    expect(logged).toContain('UNSUPPORTED_DISCOVERY_SHAPE')
    expect(logged).not.toContain('private-value')
    expect(logged).not.toContain('newShape')
  })
  it('does not let adapter continuations bypass advertised schemas', async () => {
    const d = dependencies()
    const result = await discoverRecursively(
      [
        {
          ...root,
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            additionalProperties: false,
          },
        },
      ],
      'guides',
      d,
    )
    expect(result.calls).toBe(1)
    expect(result.warnings).toContain(
      'A discovery call failed input validation.',
    )
  })
  it('flattens a package index without filtering by the user query', () => {
    const page = kodyDiscovery.parse(
      wrap({
        kind: 'entity',
        type: 'package',
        detailMode: 'index',
        entityRef: 'package:example',
        title: '@example/tools',
        exports: [
          { subpath: './read', description: 'Read activity' },
          { subpath: './send', description: 'Send a message' },
        ],
      }),
    )
    expect(page.entries).toHaveLength(2)
    expect(page.entries[0].next?.arguments).toEqual({
      entity: 'package:example#./read',
    })
    expect(page.entries[1].invocation).toBe('')
  })
  it('retains package export identities, types, and setup prerequisites', () => {
    const page = kodyDiscovery.parse(
      wrap({
        kind: 'entity',
        type: 'package',
        detailMode: 'export',
        entityRef: 'package:example#read',
        importSpecifier: 'kody:@example/activity/read',
        functions: [
          { name: 'read', typeDefinition: 'read(input: Input)' },
          { name: 'default' },
        ],
        referencedTypes: [{ definition: 'type Input = { id: string }' }],
        followUp: 'Fork this package before importing it.',
      }),
    )
    expect(page.entries).toHaveLength(2)
    expect(page.entries[0].identity).not.toBe(page.entries[1].identity)
    expect(page.entries[0].invocation).toContain('Fork this package')
    expect(page.entries[0].invocation).toContain('type Input')
    expect(page.entries[0].next).toBeUndefined()
  })
  it('shape diagnostics omit keys and primitive values', () => {
    expect(responseShape({ secretKey: 'secret', token: 123 })).toBe(
      '{number,string}',
    )
  })
})

it('reads paired contracts through metadata search and rejects unsupported entity kinds', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const call = async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return { contract: true }
  }
  expect(
    await kodyDiscovery.describe!('capability:emailMessageList', call),
  ).toEqual({ contract: true })
  expect(calls).toEqual([
    { name: 'search', args: { entity: 'capability:emailMessageList' } },
  ])
  expect(() => kodyDiscovery.describe!('secret:private-key', call)).toThrow(
    'Unsupported contract reference',
  )
  expect(calls).toHaveLength(1)
})
