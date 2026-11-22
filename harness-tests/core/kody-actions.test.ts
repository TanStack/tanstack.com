import { describe, it, expect } from 'vitest'
import {
  KodyActionCatalog,
  compileKodyAction,
} from '../../src/chat/server/kody-actions'

const packageRevision = {
  id: '149fd608-2ec1-4da1-9d93-f85816d74ccc',
  sourceId: '901e03c0-f21f-4860-90fb-555edbaeccba',
  publishedCommit: '8f1511867e03534537690f453a77040255ee9738',
}

function contract(id: string, extra = {}) {
  return {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'capability',
        id,
        entityRef: 'capability:' + id,
        source: 'builtin',
        inputTypeDefinition: 'type Input = Record<string, never>',
        ...extra,
      },
    },
  }
}
describe('discovered action contracts', () => {
  it('marks only explicitly read-only capabilities as safe to skip catalog sync', () => {
    const catalog = new KodyActionCatalog()
    catalog.register(
      contract('deviceStatus', { readOnly: true }),
      'capability:deviceStatus',
    )
    expect(
      catalog.selectEntity('capability:deviceStatus', undefined, {}).readOnly,
    ).toBe(true)
    catalog.register(contract('deviceStatus'), 'capability:deviceStatus')
    expect(
      catalog.selectEntity('capability:deviceStatus', undefined, {}).readOnly,
    ).toBeUndefined()
  })
  it('selects an inspected entity without exposing an action handle to the model', () => {
    const catalog = new KodyActionCatalog()
    expect(catalog.hasInspected('capability:deviceStatus')).toBe(false)
    expect(() =>
      catalog.selectEntity('capability:deviceStatus', undefined, {}),
    ).toThrow('Inspect')
    catalog.register(contract('deviceStatus'), 'capability:deviceStatus')
    expect(catalog.hasInspected('capability:deviceStatus')).toBe(true)
    expect(
      compileKodyAction(
        catalog.selectEntity('capability:deviceStatus', undefined, {}),
      ).code,
    ).toContain('kody["deviceStatus"](params)')
    expect(() =>
      catalog.selectEntity('capability:other', undefined, {}),
    ).toThrow('Inspect')
    expect(() =>
      catalog.selectEntity('capability:deviceStatus', 'other', {}),
    ).toThrow('No supported action')
    catalog.register({ isError: true }, 'capability:deviceStatus')
    expect(() =>
      catalog.selectEntity('capability:deviceStatus', undefined, {}),
    ).toThrow('No supported action')
  })
  it('requires an exact operation when one package exposes several functions', () => {
    const catalog = new KodyActionCatalog()
    catalog.register(
      contract('sample', {
        type: 'package',
        ...packageRevision,
        entityRef: 'package:sample#status',
        importSpecifier: 'kody:@example/devices/status',
        functions: [{ name: 'read' }, { name: 'write' }],
      }),
      'package:sample#./status',
    )
    expect(() =>
      catalog.selectEntity('package:sample#./status', undefined, {}),
    ).toThrow('Choose one package operation')
    expect(
      compileKodyAction(
        catalog.selectEntity('package:sample#./status', 'read', {}),
      ).code,
    ).toContain('entry["read"](params)')
    expect(() =>
      catalog.selectEntity('package:sample#./status', 'delete', {}),
    ).toThrow('No supported action')
  })
  it.each(['listDocuments', 'readDevices', 'findAppointments'])(
    'uses the same template for %s',
    (id) => {
      const catalog = new KodyActionCatalog()
      const [choice] = catalog.register(contract(id), 'capability:' + id)
      const action = catalog.select(choice.actionId, {})
      expect(compileKodyAction(action).code).toContain(
        'kody["' + id + '"](params)',
      )
      expect(() =>
        new KodyActionCatalog().select(choice.actionId, {}),
      ).toThrow()
      expect(() => catalog.select(choice.actionId, { extra: true })).toThrow()
    },
  )
  it('passes arguments separately and admits only inspected handles', () => {
    const catalog = new KodyActionCatalog()
    const [choice] = catalog.register(
      contract('lookup', {
        inputTypeDefinition: 'type Input = { query: string }',
        requiredInputFields: ['query'],
        executeExample: 'evil()',
      }),
      'capability:lookup',
    )
    expect(choice.validation).toBe('documented-fields')
    expect(() => catalog.select(choice.actionId, {})).toThrow()
    expect(() =>
      catalog.select(choice.actionId, {
        query: 'devices',
        queries: ['devices'],
      }),
    ).toThrow('unsupported fields: queries')
    const compiled = compileKodyAction(
      catalog.select(choice.actionId, { query: '"; evil()' }),
    )
    expect(compiled.params).toEqual({ query: '"; evil()' })
    expect(compiled.code).not.toContain('evil')
    expect(() => catalog.select('invented', {})).toThrow()
  })
  it('normalizes package exports without copying executable examples', () => {
    const catalog = new KodyActionCatalog()
    const [choice] = catalog.register(
      contract('sample', {
        type: 'package',
        ...packageRevision,
        entityRef: 'package:sample',
        importSpecifier: 'kody:@example/devices',
        functions: [
          { name: 'status', typeDefinition: '(input: object) => object' },
        ],
      }),
      'package:sample',
    )
    expect(
      compileKodyAction(catalog.select(choice.actionId, {})).code,
    ).toContain('entry["status"](params)')
  })
  it('rejects legacy targets and source injection', () => {
    expect(() =>
      compileKodyAction({
        version: 1,
        entity: 'capability:integrationList',
        input: {},
      }),
    ).toThrow()
    expect(
      new KodyActionCatalog().register(contract('x"];evil()'), 'capability:x'),
    ).toEqual([])
  })
  it('prepares inspected connected tools and checks the server again at execution', async () => {
    const catalog = new KodyActionCatalog()
    const [choice] = catalog.register(
      contract('mcp:home:get_status', {
        source: 'mcp-server',
        inputTypeDefinition: 'type Input = { device: string }',
        requiredInputFields: ['device'],
        mcpServer: {
          serverId: 'server-1',
          serverName: 'Home',
          kodyName: 'home',
          mcpToolName: 'get_status',
          toolName: 'get_status',
        },
      }),
      'capability:mcp:home:get_status',
    )
    const input = { device: 'lamp' }
    const compiled = compileKodyAction(catalog.select(choice.actionId, input))
    expect(compiled.params).toEqual(input)
    expect(compiled.code).not.toContain('lamp')
    const body = compiled.code
      .replace(/^import .*\n/, '')
      .replace('export default async function main', 'async function main')
    const server = {
      id: 'server-1',
      name: 'Home',
      enabled: true,
      connected: true,
      usageMode: 'any',
      tools: ['get_status'],
    }
    const run = (listed: typeof server) =>
      new Function('kody', 'params', body + '\nreturn main(params)')(
        {
          mcpServerList: async () => ({ servers: [listed] }),
          mcp: { home: { get_status: async (args: unknown) => args } },
        },
        compiled.params,
      )
    expect(await run(server)).toEqual(input)
    await expect(run({ ...server, id: 'replacement' })).rejects.toThrow(
      'unavailable',
    )
    await expect(run({ ...server, usageMode: 'packages' })).rejects.toThrow(
      'unavailable',
    )
    await expect(run({ ...server, connected: false })).rejects.toThrow(
      'unavailable',
    )
    await expect(run({ ...server, tools: [] })).rejects.toThrow('unavailable')
  })
  it('rejects guessed MCP arguments when the inspected type lists a different optional field', () => {
    const catalog = new KodyActionCatalog()
    const [choice] = catalog.register(
      contract('mcp:docs:search', {
        source: 'mcp-server',
        inputTypeDefinition:
          'type DocsSearchInput = {\n  /** Topic to search */\n  query?: string\n}',
        requiredInputFields: [],
        mcpServer: {
          serverId: 'docs-1',
          serverName: 'Docs',
          kodyName: 'docs',
          mcpToolName: 'search',
          toolName: 'search',
        },
      }),
      'capability:mcp:docs:search',
    )
    expect(() =>
      catalog.select(choice.actionId, { queries: ['HTTP trigger'] }),
    ).toThrow('Documented fields: query')
    expect(
      catalog.select(choice.actionId, { query: 'HTTP trigger' }).input,
    ).toEqual({ query: 'HTTP trigger' })
  })
  it('recognizes canonical export references without accepting another export', () => {
    const catalog = new KodyActionCatalog()
    const response = contract('sample', {
      type: 'package',
      ...packageRevision,
      entityRef: 'package:sample#status',
      importSpecifier: 'kody:@example/devices/status',
      functions: [
        {
          name: 'default',
          typeDefinition: 'export default function status(params: {})',
        },
      ],
    })
    const [choice] = catalog.register(response, 'package:sample#./status')
    expect(
      compileKodyAction(catalog.select(choice.actionId, {})).code,
    ).toContain('entry["default"](params)')
    expect(catalog.register(response, 'package:sample#./delete')).toEqual([])
  })
  it('requires inspected setup evidence and rejects credentials', () => {
    const catalog = new KodyActionCatalog()
    catalog.register(
      contract('setup', {
        type: 'guide',
        entityRef: 'guide:setup',
        body: 'Visit https://example.com/connect',
      }),
      'guide:setup',
    )
    expect(
      catalog.setupLink('guide:setup', 'https://example.com/connect'),
    ).toBe('https://example.com/connect')
    expect(() =>
      catalog.setupLink('guide:setup', 'https://example.com/con'),
    ).toThrow()
    expect(() =>
      catalog.setupLink('invented', 'https://example.com/connect'),
    ).toThrow()
    expect(() =>
      catalog.setupLink('guide:setup', 'https://unrelated.com/connect'),
    ).toThrow()
    expect(() =>
      catalog.setupLink(
        'guide:setup',
        'https://example.com/connect?access_token=secret',
      ),
    ).toThrow()
  })
  it('accepts a documented prose setup link without inventing an executable contract', () => {
    const catalog = new KodyActionCatalog()
    expect(
      catalog.register(
        {
          content: [
            {
              type: 'text',
              text: 'Connect at https://example.com/connect?service=calendar',
            },
          ],
        },
        'guide:connect',
      ),
    ).toEqual([])
    expect(
      catalog.setupLink(
        'guide:connect',
        'https://example.com/connect?service=calendar',
      ),
    ).toBe('https://example.com/connect?service=calendar')
    expect(() =>
      catalog.setupLink(
        'guide:connect',
        'https://example.com/connect?service=calendar&scope=admin',
      ),
    ).toThrow()
    catalog.register(
      {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'https://example.com/connect?service=calendar',
          },
        ],
      },
      'guide:connect',
    )
    expect(() =>
      catalog.setupLink(
        'guide:connect',
        'https://example.com/connect?service=calendar',
      ),
    ).toThrow('Inspect setup documentation')
  })
  it('does not treat a package export subpath in Kody prose as a setup URL', () => {
    const catalog = new KodyActionCatalog('https://kody.codes')
    const entity =
      'package:149fd608-2ec1-4da1-9d93-f85816d74ccc#./list-conversations'
    catalog.register(
      {
        content: [
          {
            type: 'text',
            text: '# Package export — `slack` / `list-conversations`',
          },
        ],
      },
      entity,
    )
    expect(() =>
      catalog.setupLink(entity, 'https://kody.codes/list-conversations'),
    ).toThrow('must come from the inspected documentation')
  })
})
