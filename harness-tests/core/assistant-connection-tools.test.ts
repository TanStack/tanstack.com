import { describe, expect, it, vi } from 'vitest'
import { assistantConnectionTools } from '../../src/chat/server/assistant-connection-tools'
import type { McpSetupSummary } from '../../src/chat/core/mcp-setup'

const workspaceId = 'personal:viewer'
const accountId = 'c9dd1cf0-320e-4779-937c-50ea1a88ca42'
const setupId = '44907ba9-597d-41a6-b707-e969598cc588'

function fixture(options: { connected?: boolean; allowMcp?: boolean } = {}) {
  const pause = vi.fn(async () => {})
  const prepareRemote = vi.fn(
    async (): Promise<McpSetupSummary> => ({
      id: setupId,
      accountId,
      label: 'Example',
      url: 'https://example.com/mcp',
      status: 'review',
      kind: 'oauth',
      scopes: ['read'],
      expiresAt: Date.now() + 600000,
    }),
  )
  const listKody = vi.fn(async () => !!options.connected)
  const listRemote = vi.fn(async () => [])
  const tools = assistantConnectionTools({
    workspaceId,
    botId: 'kody:viewer',
    turnId: 'turn',
    request: 'Connect an MCP service',
    allowKody: true,
    allowMcp: options.allowMcp ?? true,
    listKody,
    listRemote,
    prepareRemote,
    pause,
  })
  return {
    list: tools.find((tool) => tool.name === 'list_mcp_connections')!,
    prepare: tools.find((tool) => tool.name === 'prepare_mcp_connection')!,
    pause,
    prepareRemote,
    listKody,
    listRemote,
  }
}

describe('assistant MCP connection setup', () => {
  it('hands off Kody sign-in through the existing settings flow', async () => {
    const f = fixture()
    const result = await f.prepare.execute!({ target: 'kody' })
    expect(result).toMatchObject({ status: 'awaiting_user_step' })
    expect(f.pause).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Connect Kody',
        url: '/w/personal%3Aviewer/b/kody%3Aviewer?settings=general',
        connection: { kind: 'kody' },
      }),
    )
    expect(f.prepareRemote).not.toHaveBeenCalled()

    const connected = fixture({ connected: true })
    expect(await connected.prepare.execute!({ target: 'kody' })).toEqual({
      status: 'connected',
      service: 'Kody',
    })
    expect(connected.pause).not.toHaveBeenCalled()
  })

  it('requires a real remote endpoint before creating a reviewed setup', async () => {
    const f = fixture()
    await expect(
      f.prepare.execute!({ target: 'remote', label: 'Example' }),
    ).rejects.toThrow('exact Streamable HTTP')
    expect(f.prepareRemote).not.toHaveBeenCalled()
    expect(f.pause).not.toHaveBeenCalled()

    const result = await f.prepare.execute!({
      target: 'remote',
      label: 'Example',
      url: 'https://example.com/mcp',
    })
    expect(result).toMatchObject({ status: 'awaiting_user_step' })
    expect(f.prepareRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Example',
        url: 'https://example.com/mcp',
        returnBotId: 'kody:viewer',
      }),
    )
    expect(f.pause).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/w/personal%3Aviewer/b/kody%3Aviewer?settings=mcp&connectionSetup=${setupId}`,
        connection: { kind: 'mcp', setupId, accountId },
      }),
    )
  })

  it('does not prepare a connection when workspace policy forbids it', async () => {
    const f = fixture({ allowMcp: false })
    expect(await f.list.execute!({})).toMatchObject({
      remote: { allowed: false, connections: [] },
    })
    expect(
      await f.prepare.execute!({
        target: 'remote',
        label: 'Example',
        url: 'https://example.com/mcp',
      }),
    ).toMatchObject({ status: 'unavailable' })
    expect(f.prepareRemote).not.toHaveBeenCalled()
    expect(f.pause).not.toHaveBeenCalled()
  })
})
