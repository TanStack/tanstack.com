import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  maxPluginBytes,
  maxPluginFileBytes,
  parsePluginPackage,
  parsedPluginPackageSchema,
  pluginFileTableSchema,
  pluginManifestSchemaId,
  pluginMcpSchemaId,
  type PluginFile,
} from '../../src/chat/core/plugins'
import {
  pluginCommandSchema,
  pluginVersionSchema,
} from '../../src/chat/core/plugin-lifecycle'

const manifest = (fields: Record<string, unknown> = {}): PluginFile => ({
  path: 'plugin.json',
  text: JSON.stringify({
    $schema: pluginManifestSchemaId,
    name: 'example.tools',
    ...fields,
  }),
})
const skill = (name = 'review'): PluginFile => ({
  path: `skills/${name}/SKILL.md`,
  text: `---\nname: ${name}\ndescription: Review the evidence.\n---\nKeep the supplied facts and source qualifications.\n`,
})
const mcp = (
  servers: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): PluginFile => ({
  path: 'mcp.json',
  text: JSON.stringify({
    $schema: pluginMcpSchemaId,
    mcpServers: servers,
    ...extra,
  }),
})
const remote = { type: 'streamable-http', url: 'https://tools.example.com/mcp' }
const codes = (result: Awaited<ReturnType<typeof parsePluginPackage>>) =>
  result.compatibility.issues.map((issue) => issue.code)
afterEach(() => vi.unstubAllGlobals())

describe('Agent Plugins file table and immutable content', () => {
  it('loads fixed skill and remote MCP locations without contacting or evaluating anything', async () => {
    const fetch = vi.fn(() => {
      throw Error('No network during package parsing')
    })
    vi.stubGlobal('fetch', fetch)
    const files = [manifest(), skill(), mcp({ notes: remote })]
    const result = await parsePluginPackage(files)
    expect(result.manifest.name).toBe('example.tools')
    expect(result.skills[0].document.name).toBe('review')
    expect(result.mcpServers).toEqual([
      { key: 'notes', ...remote, supported: true },
    ])
    expect(result.compatibility).toEqual({ status: 'supported', issues: [] })
    expect(parsedPluginPackageSchema.parse(result)).toEqual(result)
    expect(files[0].path).toBe('plugin.json')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('computes a byte-exact domain-separated digest, independent of upload order', async () => {
    const files = [
      manifest(),
      skill(),
      { path: 'README.md', text: 'café 🙂\r\n' },
    ]
    const hash = (value: string | Uint8Array) =>
      createHash('sha256').update(value).digest('hex')
    const expected =
      'sha256:' +
      hash(
        JSON.stringify([
          'gum-plugin-files-v1',
          [...files]
            .sort((a, b) => (a.path < b.path ? -1 : 1))
            .map(({ path, text }) => [
              path,
              Buffer.byteLength(text),
              hash(text),
            ]),
        ]),
      )
    const result = await parsePluginPackage(files)
    expect(result.digest).toBe(expected)
    expect((await parsePluginPackage([...files].reverse())).digest).toBe(
      expected,
    )
    expect(
      (
        await parsePluginPackage(
          files.map((file) =>
            file.path === 'README.md'
              ? { ...file, text: file.text.replace('\r\n', '\n') }
              : file,
          ),
        )
      ).digest,
    ).not.toBe(expected)
    expect(result.files.find((file) => file.path === 'README.md')?.text).toBe(
      'café 🙂\r\n',
    )
  })

  it.each([
    '/plugin.json',
    '../plugin.json',
    'a/../plugin.json',
    './plugin.json',
    'a//plugin.json',
    'a\\plugin.json',
    'C:/plugin.json',
    'a/./plugin.json',
    'a/\u0000x',
    'a/\u202ex',
    're\u0301sume/file',
  ])('rejects unsafe or noncanonical path %j', async (path) => {
    await expect(
      parsePluginPackage([manifest(), { path, text: '' }]),
    ).rejects.toThrow(/canonical relative/)
  })

  it('rejects duplicate, case-colliding, compatibility-colliding and file/directory paths', async () => {
    for (const paths of [
      ['readme', 'readme'],
      ['README', 'readme'],
      ['Ｋ.txt', 'K.txt'],
      ['directory', 'directory/file'],
      ['DIRECTORY', 'directory/file'],
    ]) {
      await expect(
        parsePluginPackage([
          manifest(),
          ...paths.map((path) => ({ path, text: '' })),
        ]),
      ).rejects.toThrow(/duplicate paths|both a file and a directory/)
    }
  })

  it('rejects link metadata and binary text without accepting replacement of invalid Unicode', async () => {
    await expect(
      parsePluginPackage([
        { ...manifest(), type: 'symlink', target: '/etc/passwd' },
      ]),
    ).rejects.toThrow()
    await expect(
      parsePluginPackage([manifest(), { path: 'x', text: 'a\0b' }]),
    ).rejects.toThrow(/NUL/)
    await expect(
      parsePluginPackage([manifest(), { path: 'x', text: '\ud800' }]),
    ).rejects.toThrow(/Unicode/)
    await expect(
      parsePluginPackage([manifest(), { path: 'x', text: '🙂' }]),
    ).resolves.toBeDefined()
  })

  it('bounds UTF-8 bytes rather than JavaScript character counts, file count and package bytes', async () => {
    expect(
      pluginFileTableSchema.safeParse([
        { path: 'data.txt', text: 'é'.repeat(maxPluginFileBytes / 2) },
      ]).success,
    ).toBe(true)
    expect(
      pluginFileTableSchema.safeParse([
        { path: 'data.txt', text: 'é'.repeat(maxPluginFileBytes / 2 + 1) },
      ]).success,
    ).toBe(false)
    expect(
      pluginFileTableSchema.safeParse(
        Array.from({ length: 129 }, (_, i) => ({ path: `${i}.txt`, text: '' })),
      ).success,
    ).toBe(false)
    const exact = Array.from({ length: 4 }, (_, i) => ({
      path: `${i}.txt`,
      text: 'x'.repeat(maxPluginBytes / 4),
    }))
    expect(pluginFileTableSchema.safeParse(exact).success).toBe(true)
    expect(
      pluginFileTableSchema.safeParse([
        ...exact,
        { path: 'one.txt', text: 'x' },
      ]).success,
    ).toBe(false)
  })
})

describe('portable manifest and narrow component failures', () => {
  it('accepts recommended-but-not-required semantic versions and metadata syntax', async () => {
    const result = await parsePluginPackage([
      manifest({
        version: 'weekly-canary',
        homepage: 'not a URL',
        license: 'See agreement',
        author: { email: 'contact us' },
      }),
      skill(),
    ])
    expect(result.manifest.version).toBe('weekly-canary')
    expect(result.manifest.homepage).toBe('not a URL')
    expect(result.compatibility.status).toBe('supported')
  })

  it.each(['a', 'a-b', 'a.b', 'a-.b', 'a.-b', 'x'.repeat(64)])(
    'accepts exact portable plugin name %s',
    async (name) => {
      expect(
        (await parsePluginPackage([manifest({ name }), skill()])).manifest.name,
      ).toBe(name)
    },
  )
  it.each([
    '',
    'Upper',
    'réview',
    'a_b',
    '-a',
    'a.',
    'a--b',
    'a..b',
    'x'.repeat(65),
  ])('rejects invalid plugin name %j', async (name) => {
    await expect(parsePluginPackage([manifest({ name })])).rejects.toThrow(
      /plugin.json name/,
    )
  })

  it('reports and ignores unknown top-level fields without following their paths', async () => {
    const result = await parsePluginPackage([
      manifest({
        skills: 'other/',
        mcpServers: { evil: remote },
        otherField: './run.sh',
      }),
      skill(),
    ])
    expect(result.skills).toHaveLength(1)
    expect(result.mcpServers).toEqual([])
    expect(result.compatibility.status).toBe('supported')
    expect(codes(result)).toEqual([
      'unknown_manifest_field',
      'unknown_manifest_field',
      'unknown_manifest_field',
    ])
    expect(result.manifest).not.toHaveProperty('mcpServers')
  })

  it('ignores unknown extension values without validating host-owned data', async () => {
    for (const extensions of [
      { 'com.other.host': null },
      { 'com.other.host': 4 },
      { 'com.other.host': { script: './install.sh' } },
    ]) {
      const result = await parsePluginPackage([
        manifest({ extensions }),
        skill(),
      ])
      expect(result.skills).toHaveLength(1)
      expect(result.compatibility.status).toBe('partial')
      expect(codes(result)).toContain('unsupported_extension')
    }
    const result = await parsePluginPackage([
      manifest({ extensions: [] }),
      skill(),
    ])
    expect(result.compatibility.status).toBe('supported')
    expect(codes(result)).toEqual(['invalid_extensions'])
  })

  it('rejects invalid recognized metadata, duplicate JSON keys and incompatible root schemas', async () => {
    for (const fields of [
      { version: 4 },
      { description: {} },
      { author: { unsupported: true } },
      { $schema: 'https://example.com/schema' },
      { $schema: undefined },
    ])
      await expect(parsePluginPackage([manifest(fields)])).rejects.toThrow()
    await expect(
      parsePluginPackage([
        {
          path: 'plugin.json',
          text: `{"$schema":"${pluginManifestSchemaId}","name":"one","name":"two"}`,
        },
      ]),
    ).rejects.toThrow(/duplicate keys/)
    await expect(
      parsePluginPackage([{ path: '.codex-plugin/plugin.json', text: '{}' }]),
    ).rejects.toThrow(/at its root/)
  })

  it('discovers immediate skill directories and retains readable resources/scripts without executing them', async () => {
    const nested = { ...skill('nested'), path: 'skills/outer/inner/SKILL.md' }
    const script = {
      path: 'skills/review/scripts/action.js',
      text: 'globalThis.pluginExecuted = true',
    }
    const result = await parsePluginPackage([
      manifest(),
      skill(),
      nested,
      script,
      { path: 'README.md', text: 'inspect me' },
    ])
    expect(result.skills.map((entry) => entry.document.name)).toEqual([
      'review',
    ])
    expect(result.files).toContainEqual(script)
    expect(result.compatibility.status).toBe('supported')
    expect(
      result.compatibility.issues.find((issue) => issue.path === nested.path)
        ?.severity,
    ).toBe('warning')
    expect(globalThis).not.toHaveProperty('pluginExecuted')
  })

  it('supports a skill with bundled UTF-8 references and code examples as readable inert resources', async () => {
    const resources = [
      {
        path: 'skills/review/references/evidence.md',
        text: '# Evidence\nExact facts\n',
      },
      {
        path: 'skills/review/scripts/example.ts',
        text: 'throw new Error("Do not execute during import")\n',
      },
      {
        path: 'skills/review/assets/template.html',
        text: '<h1>Text template</h1>',
      },
    ]
    const result = await parsePluginPackage([manifest(), skill(), ...resources])
    expect(result.compatibility).toEqual({ status: 'supported', issues: [] })
    for (const resource of resources)
      expect(result.files).toContainEqual(resource)
  })

  it('reports declared native hooks or UI separately from inert script text', async () => {
    const declared = await parsePluginPackage([
      manifest({ hooks: './hooks.json', ui: { entry: './ui.tsx' } }),
      skill(),
      { path: 'ui.tsx', text: 'export default null' },
    ])
    expect(declared.compatibility.status).toBe('partial')
    expect(
      codes(declared).filter((code) => code === 'unsupported_host_capability'),
    ).toHaveLength(2)
    const hooks = await parsePluginPackage([
      manifest(),
      skill(),
      { path: 'hooks/hooks.json', text: '{"hooks":{}}' },
    ])
    expect(codes(hooks)).toContain('unsupported_package_declaration')
    expect(hooks.compatibility.status).toBe('partial')
  })

  it('preserves useful siblings when one skill is malformed or exceeds host limits', async () => {
    const bad = { ...skill('bad'), text: 'no frontmatter' }
    const mismatch = { ...skill('different'), path: 'skills/mismatch/SKILL.md' }
    const long = {
      ...skill('long'),
      text: skill('long').text + 'x'.repeat(12001),
    }
    const result = await parsePluginPackage([
      manifest(),
      skill('工作'),
      bad,
      mismatch,
      long,
      mcp({ notes: remote }),
    ])
    expect(result.skills.map((entry) => entry.document.name)).toEqual(['工作'])
    expect(result.mcpServers[0].supported).toBe(true)
    expect(
      codes(result).filter((code) => code === 'unsupported_skill'),
    ).toHaveLength(3)
    expect(result.compatibility.status).toBe('partial')
  })

  it('marks empty packages valid but without supported capabilities', async () => {
    const result = await parsePluginPackage([manifest()])
    expect(result.skills).toEqual([])
    expect(result.compatibility.status).toBe('unsupported')
    expect(codes(result)).toContain('no_supported_components')
  })

  it('reports wrong-kind component locations and preserves other component types', async () => {
    const wrongSkills = await parsePluginPackage([
      manifest(),
      { path: 'skills', text: '' },
      mcp({ notes: remote }),
    ])
    expect(wrongSkills.mcpServers[0].supported).toBe(true)
    expect(codes(wrongSkills)).toContain('invalid_skills_location')
    const wrongMcp = await parsePluginPackage([
      manifest(),
      skill(),
      { path: 'mcp.json/example.txt', text: '{}' },
    ])
    expect(wrongMcp.skills).toHaveLength(1)
    expect(codes(wrongMcp)).toContain('invalid_mcp_location')
  })

  it('makes component-count host limits explicit without silently clipping entries', async () => {
    const result = await parsePluginPackage([
      manifest(),
      ...Array.from({ length: 33 }, (_, i) => skill(`skill-${i}`)),
      mcp({ notes: remote }),
    ])
    expect(result.skills).toEqual([])
    expect(codes(result)).toContain('skills_limit')
    const manyMcp = await parsePluginPackage([
      manifest(),
      skill(),
      mcp(
        Object.fromEntries(
          Array.from({ length: 33 }, (_, i) => [`server-${i}`, remote]),
        ),
      ),
    ])
    expect(manyMcp.mcpServers).toEqual([])
    expect(codes(manyMcp)).toContain('mcp_limit')
  })
})

describe('portable MCP configuration and Gum capabilities', () => {
  it('keeps skill support when the MCP top-level schema is invalid or mismatched', async () => {
    for (const file of [
      mcp(
        { notes: remote },
        { $schema: 'https://agent-plugins.org/schemas/2.0.0/mcp.schema.json' },
      ),
      mcp({ notes: remote }, { extra: true }),
      { path: 'mcp.json', text: 'bad json' },
    ]) {
      const result = await parsePluginPackage([manifest(), skill(), file])
      expect(result.skills).toHaveLength(1)
      expect(result.mcpServers).toEqual([])
      expect(codes(result)).toContain('invalid_mcp_configuration')
    }
  })

  it('isolates invalid entries and distinguishes unsupported declared transports', async () => {
    const result = await parsePluginPackage([
      manifest(),
      mcp({
        good: remote,
        implicit: { url: remote.url },
        badField: { ...remote, command: 'server' },
        legacy: { type: 'sse', url: remote.url },
        local: {
          type: 'stdio',
          command: 'node',
          args: ['${PLUGIN_ROOT}/index.js'],
          env: { PATH: 'literal' },
        },
      }),
    ])
    expect(
      result.mcpServers.map(({ key, supported }) => [key, supported]),
    ).toEqual([
      ['good', true],
      ['legacy', false],
      ['local', false],
    ])
    expect(result.mcpServers[2].args).toEqual(['${PLUGIN_ROOT}/index.js'])
    expect(codes(result)).toEqual([
      'invalid_mcp_server',
      'invalid_mcp_server',
      'unsupported_sse',
      'unsupported_stdio',
    ])
  })

  it('rejects reserved stdio variables and escaping executable/working directory paths', async () => {
    const result = await parsePluginPackage([
      manifest(),
      skill(),
      mcp({
        command: { type: 'stdio', command: './../../../launch' },
        shell: { type: 'stdio', command: 'node server.js' },
        cwd: {
          type: 'stdio',
          command: 'node',
          cwd: '${PLUGIN_DATA}/../outside',
        },
        env: { type: 'stdio', command: 'node', env: { PLUGIN_ROOT: '/wrong' } },
      }),
    ])
    expect(result.mcpServers).toEqual([])
    expect(codes(result)).toEqual(Array(4).fill('invalid_stdio_configuration'))
  })

  it('separates valid portable URLs from stricter cloud connection policy', async () => {
    const result = await parsePluginPackage([
      manifest(),
      skill(),
      mcp({
        loopback: { ...remote, url: 'http://127.0.0.1:3000/mcp' },
        query: { ...remote, url: remote.url + '?tenant=x' },
        invalid: { ...remote, url: 'http://example.com/mcp' },
        userinfo: { ...remote, url: 'https://secret@example.com/mcp' },
        fragment: { ...remote, url: remote.url + '#part' },
      }),
    ])
    expect(result.mcpServers.map((server) => server.key)).toEqual([
      'loopback',
      'query',
    ])
    expect(result.mcpServers.every((server) => !server.supported)).toBe(true)
    expect(
      codes(result).filter((code) => code === 'invalid_mcp_url'),
    ).toHaveLength(3)
  })

  it('never expands or silently drops headers and rejects invalid names or duplicate casing', async () => {
    const result = await parsePluginPackage([
      manifest(),
      skill(),
      mcp({
        literal: { ...remote, headers: { 'X-Tenant': '${ENV_TOKEN}' } },
        duplicate: { ...remote, headers: { 'X-Tenant': 'a', 'x-tenant': 'b' } },
        injection: {
          ...remote,
          headers: { 'X-Test': 'value\r\nInjected: yes' },
        },
        badName: { ...remote, headers: { 'Not A Header': 'value' } },
      }),
    ])
    expect(result.mcpServers).toEqual([
      {
        key: 'literal',
        ...remote,
        headers: { 'X-Tenant': '${ENV_TOKEN}' },
        supported: false,
      },
    ])
    expect(codes(result)).toEqual([
      'unsupported_mcp_headers',
      'invalid_mcp_headers',
      'invalid_mcp_headers',
      'invalid_mcp_headers',
    ])
  })

  it('keeps identical server names separate at installation identity rather than inventing global authority', async () => {
    const first = await parsePluginPackage([
      manifest({ name: 'first' }),
      mcp({ same: remote }),
    ])
    const second = await parsePluginPackage([
      manifest({ name: 'second' }),
      mcp({ same: { ...remote, url: 'https://other.example.com/mcp' } }),
    ])
    expect(first.mcpServers[0].key).toBe(second.mcpServers[0].key)
    expect(first.digest).not.toBe(second.digest)
    expect(first.mcpServers[0]).not.toHaveProperty('serverId')
  })

  it('preserves literal prototype-looking map keys instead of silently changing configuration', async () => {
    const headers = JSON.parse(
      '{"__proto__":"public-value","constructor":"other"}',
    )
    const env = JSON.parse('{"__proto__":"inert","constructor":"other"}')
    const result = await parsePluginPackage([
      manifest(),
      skill(),
      mcp({
        remote: { ...remote, headers },
        local: { type: 'stdio', command: 'node', env },
      }),
    ])
    expect(Object.entries(result.mcpServers[0].headers!)).toEqual(
      Object.entries(headers),
    )
    expect(Object.entries(result.mcpServers[1].env!)).toEqual(
      Object.entries(env),
    )
    expect(
      parsedPluginPackageSchema.parse(result).mcpServers[0].headers,
    ).toEqual(headers)
    expect(result.mcpServers.every((server) => !server.supported)).toBe(true)
  })
})

describe('client-safe lifecycle contract', () => {
  it('does not accept server-selected credentials or install receipts from the client', async () => {
    const id = crypto.randomUUID(),
      commandId = crypto.randomUUID()
    const parsed = await parsePluginPackage([manifest(), skill()])
    const command = {
      type: 'install',
      id,
      commandId,
      files: parsed.files,
      digest: parsed.digest,
    }
    const installation = pluginCommandSchema.parse(command)
    if (installation.type !== 'install')
      throw new Error('Expected an install command')
    expect(installation.enabled).toBe(false)
    expect(
      pluginCommandSchema.safeParse({ ...command, accessToken: 'not allowed' })
        .success,
    ).toBe(false)
    const version = {
      id,
      name: parsed.manifest.name,
      description: '',
      currentVersion: 1,
      revision: 1,
      enabled: false,
      removed: false,
      createdAt: 0,
      updatedAt: 0,
      digest: parsed.digest,
      compatibility: parsed.compatibility,
      version: 1,
      package: parsed,
      bindings: [],
    }
    expect(pluginVersionSchema.parse(version)).toEqual(version)
  })
})
