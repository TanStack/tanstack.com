import { describe, it, expect, vi } from 'vitest'
import {
  discoverRecursively,
  discoveryArguments,
  discoveryReadable,
  type Interpretation,
  type DiscoveryDependencies,
} from '../../src/chat/server/mcp-discovery'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entry = (id = 'directory', serverId = 'alpha'): CatalogEntry => ({
  id,
  serverId,
  serverLabel: serverId,
  kind: 'tool',
  name: id,
  title: id,
  description: 'Discover available tools',
  target: { method: 'tools/call', name: id },
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
})
const plan = (entryId = 'directory', query = 'updates'): Interpretation => ({
  message: 'Inspect tools',
  capabilities: [],
  next: [
    {
      entryId,
      arguments: { query },
      purpose: 'Discover matching capability metadata',
    },
  ],
})
const complete: Interpretation = {
  message: 'Found a tool',
  next: [],
  capabilities: [
    {
      name: 'recent',
      description: 'Read recent activity',
      evidence: 'Read recent activity',
      invocation: 'Call recent with the documented inputs',
    },
  ],
}
function deps(): DiscoveryDependencies {
  return {
    signal: new AbortController().signal,
    trustedServers: new Set(['alpha', 'beta']),
    choose: vi.fn<DiscoveryDependencies['choose']>(async (entries) =>
      entries.map((entry) => entry.id),
    ),
    interpret: vi
      .fn()
      .mockResolvedValueOnce(plan())
      .mockResolvedValue(complete),
    invoke: vi.fn(async () => ({
      content: [{ type: 'text', text: 'Read recent activity' }],
    })),
  }
}
describe('generic recursive discovery', () => {
  it('discovers a nested capability while preserving evidence without making it executable', async () => {
    const d = deps()
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(1)
    expect(result.candidates[1].discovered?.evidence).toBe(
      'Read recent activity',
    )
    expect(result.candidates[1].kind).toBe('capability')
    expect(discoveryReadable(result.candidates[1], d.trustedServers)).toBe(
      false,
    )
    expect(d.choose).toHaveBeenCalledTimes(2)
  })
  it('explores independent servers concurrently using the same machinery', async () => {
    const d = deps()
    let active = 0
    let peak = 0
    d.interpret = vi
      .fn()
      .mockResolvedValueOnce({
        ...plan(),
        next: [...plan().next, ...plan('other').next],
      })
      .mockResolvedValue({ ...complete, capabilities: [] })
    d.invoke = vi.fn(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return { content: [] }
    })
    const result = await discoverRecursively(
      [entry(), entry('other', 'beta')],
      'updates',
      d,
    )
    expect(result.calls).toBe(2)
    expect(peak).toBe(2)
  })
  it('follows a standard MCP resource link without inventing a provider parser', async () => {
    const d = deps()
    const resourceId = JSON.stringify(['alpha', 'resource', 'docs://tools'])
    d.invoke = vi
      .fn()
      .mockResolvedValueOnce({
        content: [
          { type: 'resource_link', uri: 'docs://tools', name: 'Tools' },
        ],
      })
      .mockResolvedValue({
        contents: [{ uri: 'docs://tools', text: 'Read recent activity' }],
      })
    d.interpret = vi
      .fn()
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce({
        ...plan(),
        next: [
          {
            entryId: resourceId,
            arguments: {},
            purpose: 'Read tool contracts',
          },
        ],
      })
      .mockResolvedValue(complete)
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(2)
    expect(d.invoke).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'resource',
        target: { method: 'resources/read', uri: 'docs://tools' },
      }),
      {},
    )
  })
  it('rejects unknown targets and invalid arguments before invoking anything', async () => {
    const d = deps()
    d.interpret = vi.fn().mockResolvedValue({
      ...plan(),
      next: [
        ...plan('invented').next,
        { ...plan().next[0], arguments: { code: 'run()' } },
      ],
    })
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(d.invoke).not.toHaveBeenCalled()
    expect(result.warnings).toHaveLength(2)
  })
  it('does not trust read-only annotations from untrusted servers or allow destructive calls', async () => {
    const d = deps()
    d.trustedServers.clear()
    await discoverRecursively([entry()], 'updates', d)
    expect(d.interpret).not.toHaveBeenCalled()
    expect(
      discoveryReadable(
        {
          ...entry(),
          annotations: { readOnlyHint: true, destructiveHint: true },
        },
        new Set(['alpha']),
      ),
    ).toBe(false)
  })
  it('stops repeated calls and does not keep invoking identical arguments', async () => {
    const d = deps()
    d.interpret = vi.fn().mockResolvedValue(plan())
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(1)
    expect(result.reason).toContain('no new valid calls')
  })
  it('rejects fabricated evidence', async () => {
    const d = deps()
    d.invoke = vi.fn(async () => ({
      content: [{ type: 'text', text: 'Unrelated result' }],
    }))
    await expect(discoverRecursively([entry()], 'updates', d)).rejects.toThrow(
      'source evidence',
    )
  })
  it('preserves successful branches when another branch fails', async () => {
    const d = deps()
    d.interpret = vi
      .fn()
      .mockResolvedValueOnce({
        ...plan(),
        next: [...plan().next, ...plan('other').next],
      })
      .mockResolvedValue(complete)
    d.invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        content: [{ type: 'text', text: 'Read recent activity' }],
      })
    const result = await discoverRecursively(
      [entry(), entry('other', 'beta')],
      'updates',
      d,
    )
    expect(result.candidates.some((c) => c.kind === 'capability')).toBe(true)
    expect(result.warnings).toContain(
      'A discovery call failed. Other branches were preserved.',
    )
  })
  it('stops on missing user prerequisites without inventing capabilities', async () => {
    const d = deps()
    d.interpret = vi.fn().mockResolvedValueOnce(plan()).mockResolvedValue({
      message: 'Connect your account',
      capabilities: [],
      next: [],
    })
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.reason).toBe('Connect your account')
    expect(result.candidates).toHaveLength(1)
  })
  it('obeys the call budget even when the model always asks for more', async () => {
    const d = deps()
    let round = 0
    d.interpret = vi.fn(async () => ({
      ...plan(),
      next: Array.from(
        { length: 3 },
        (_, i) => plan('directory', 'page-' + round + '-' + i).next[0],
      ),
      message: String(round++),
    }))
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(6)
    expect(result.warnings).toContain(
      'Discovery reached its call or round limit. Coverage is incomplete.',
    )
  })
  it('does not invoke plans Jev rejects', async () => {
    const d = deps()
    d.choose = vi
      .fn()
      .mockResolvedValueOnce(['directory'])
      .mockResolvedValue([])
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(0)
    expect(d.invoke).not.toHaveBeenCalled()
  })
  it('does not interpret anything after cancellation', async () => {
    const d = deps()
    const controller = new AbortController()
    controller.abort()
    d.signal = controller.signal
    await expect(discoverRecursively([entry()], 'updates', d)).rejects.toThrow()
    expect(d.choose).not.toHaveBeenCalled()
  })
  it('can follow a documented recovery path after a tool error', async () => {
    const d = deps()
    d.invoke = vi
      .fn()
      .mockResolvedValueOnce({
        isError: true,
        content: [
          { type: 'text', text: 'Reference missing. Browse the index.' },
        ],
      })
      .mockResolvedValue({
        content: [{ type: 'text', text: 'Read recent activity' }],
      })
    d.interpret = vi
      .fn()
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce(plan('directory', 'index'))
      .mockResolvedValue(complete)
    const result = await discoverRecursively([entry()], 'updates', d)
    expect(result.calls).toBe(2)
    expect(result.candidates.some((c) => c.kind === 'capability')).toBe(true)
  })
  it('validates required prompt arguments', () => {
    expect(() =>
      discoveryArguments(
        {
          ...entry(),
          kind: 'prompt',
          arguments: [{ name: 'topic', required: true }],
        },
        { ...plan().next[0], arguments: {} },
      ),
    ).toThrow('prompt')
  })
})
