import { z } from 'zod'
import { parseDocument } from 'yaml'
import {
  parseSkillMarkdown,
  skillDocumentSchema,
  type SkillDocument,
} from './skills'

export const pluginManifestSchemaId =
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
export const pluginMcpSchemaId =
  'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
export const maxPluginFiles = 128
export const maxPluginFileBytes = 256 * 1024
export const maxPluginBytes = 1024 * 1024
export const maxPluginSkills = 32
export const maxPluginMcpServers = 32

const encoder = new TextEncoder()
const unicode = (value: string) => !/[\uD800-\uDFFF]/u.test(value)
const safeText = z.string().refine(unicode, 'Use valid Unicode text.')
const fileSchema = z
  .object({
    path: safeText.min(1).max(512),
    text: safeText.max(maxPluginFileBytes),
  })
  .strict()

export interface PluginFile {
  path: string
  text: string
}
export interface PluginCompatibilityIssue {
  code: string
  path: string
  message: string
  severity: 'warning' | 'unsupported' | 'invalid'
}
export interface PluginCompatibility {
  status: 'supported' | 'partial' | 'unsupported'
  issues: PluginCompatibilityIssue[]
}
export interface PluginMcpServer {
  key: string
  type: 'streamable-http' | 'sse' | 'stdio'
  url?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  supported: boolean
}
export interface ParsedPluginPackage {
  format: 'agent-plugins'
  schemaVersion: '1.0.0'
  manifest: PluginManifest
  files: PluginFile[]
  digest: string
  skills: Array<{ path: string; document: SkillDocument }>
  mcpServers: PluginMcpServer[]
  compatibility: PluginCompatibility
}
export class PluginFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PluginFormatError'
  }
}

function pathError(path: string): string | undefined {
  if (
    path !== path.normalize('NFC') ||
    /[\\:\p{Cc}\p{Cf}]/u.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return 'Use canonical relative file paths without traversal, backslashes, drive names or control characters.'
}

/** An upload transport supplies regular UTF-8 files only. No links, directories,
 * executable flags or filesystem metadata can cross this boundary.
 */
export const pluginFileTableSchema = z
  .array(fileSchema)
  .min(1, 'Choose a package containing plugin.json.')
  .max(maxPluginFiles, 'Choose a package with up to 128 files.')
  .superRefine((files, context) => {
    let total = 0
    const paths = new Set<string>()
    for (const [index, file] of files.entries()) {
      const issue = pathError(file.path)
      const key = file.path.normalize('NFKC').toLowerCase()
      const size = encoder.encode(file.text).byteLength
      total += size
      const message =
        issue ??
        (paths.has(key)
          ? 'Remove duplicate paths, including names that differ only by case or Unicode compatibility forms.'
          : size > maxPluginFileBytes
            ? 'Keep each package file under 256 KiB.'
            : file.text.includes('\0')
              ? 'Package files must be UTF-8 text without NUL bytes.'
              : undefined)
      if (message)
        context.addIssue({ code: 'custom', message, path: [index, 'path'] })
      paths.add(key)
    }
    for (const [index, file] of files.entries()) {
      const parts = file.path.normalize('NFKC').toLowerCase().split('/')
      for (let end = 1; end < parts.length; end++) {
        if (paths.has(parts.slice(0, end).join('/'))) {
          context.addIssue({
            code: 'custom',
            path: [index, 'path'],
            message: 'A package path cannot be both a file and a directory.',
          })
          break
        }
      }
    }
    if (total > maxPluginBytes)
      context.addIssue({
        code: 'custom',
        message: 'Keep the package under 1 MiB of UTF-8 text.',
      })
  })

const manifestSchema = z
  .object({
    $schema: z.literal(pluginManifestSchemaId),
    name: z
      .string()
      .min(1)
      .max(64)
      .regex(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/),
    version: safeText.optional(),
    description: safeText.optional(),
    author: z
      .object({
        name: safeText.optional(),
        email: safeText.optional(),
        url: safeText.optional(),
      })
      .strict()
      .optional(),
    homepage: safeText.optional(),
    repository: safeText.optional(),
    license: safeText.optional(),
    keywords: z.array(safeText).optional(),
  })
  .strict()
export type PluginManifest = z.infer<typeof manifestSchema>

// Keep every own key, including __proto__. z.record reconstructs maps and drops
// that key, which would silently change a package's header/environment meaning.
const stringMap = z.custom<Record<string, string>>(
  (value) =>
    object(value) &&
    Object.entries(value).every(
      ([key, text]) =>
        unicode(key) && typeof text === 'string' && unicode(text),
    ),
  'Use a map of valid Unicode strings.',
)

export const pluginCompatibilitySchema = z
  .object({
    status: z.enum(['supported', 'partial', 'unsupported']),
    issues: z.array(
      z
        .object({
          code: z.string(),
          path: z.string(),
          message: z.string(),
          severity: z.enum(['warning', 'unsupported', 'invalid']),
        })
        .strict(),
    ),
  })
  .strict()

/** Shape validation for authenticated API responses. The server still reparses
 * uploaded files and computes its own digest before committing an installation.
 */
export const parsedPluginPackageSchema: z.ZodType<ParsedPluginPackage> = z
  .object({
    format: z.literal('agent-plugins'),
    schemaVersion: z.literal('1.0.0'),
    manifest: manifestSchema,
    files: pluginFileTableSchema,
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    skills: z.array(
      z.object({ path: z.string(), document: skillDocumentSchema }).strict(),
    ),
    mcpServers: z.array(
      z
        .object({
          key: z.string(),
          type: z.enum(['streamable-http', 'sse', 'stdio']),
          url: z.string().optional(),
          headers: stringMap.optional(),
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          env: stringMap.optional(),
          cwd: z.string().optional(),
          supported: z.boolean(),
        })
        .strict(),
    ),
    compatibility: pluginCompatibilitySchema,
  })
  .strict()

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function json(source: string, path: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(source)
    // JSON.parse alone silently accepts duplicate keys. YAML's JSON grammar
    // supplies duplicate-key detection only after the strict JSON parse passes.
    const duplicateCheck = parseDocument(source, {
      schema: 'json',
      uniqueKeys: true,
      strict: true,
    })
    if (duplicateCheck.errors.length) throw Error()
  } catch {
    throw new PluginFormatError(
      `${path} must be valid JSON without duplicate keys.`,
    )
  }
  if (!object(value))
    throw new PluginFormatError(`${path} must contain a JSON object.`)
  return value
}

function readManifest(
  source: string,
  issues: PluginCompatibilityIssue[],
): PluginManifest {
  const raw = json(source, 'plugin.json')
  if (raw.$schema !== pluginManifestSchemaId)
    throw new PluginFormatError(
      'Use the Agent Plugins 1.0.0 plugin.json schema. Other package versions and host manifests are not supported yet.',
    )
  const known = new Set(Object.keys(manifestSchema.shape))
  const hostCapabilities = new Set([
    'hooks',
    'apps',
    'ui',
    'lspServers',
    'agents',
    'commands',
    'workflows',
    'monitors',
  ])
  for (const key of Object.keys(raw)) {
    if (!known.has(key) && key !== 'extensions')
      issues.push({
        code: 'unknown_manifest_field',
        path: `plugin.json#${key}`,
        severity: 'warning',
        message: `Ignored unsupported manifest field ${key}. Portable components use fixed package locations.`,
      })
    if (hostCapabilities.has(key))
      issues.push({
        code: 'unsupported_host_capability',
        path: `plugin.json#${key}`,
        severity: 'unsupported',
        message: `TanChat does not activate the declared ${key} host capability. Its package text can be inspected without running it.`,
      })
  }
  if (Object.hasOwn(raw, 'extensions')) {
    if (!object(raw.extensions))
      issues.push({
        code: 'invalid_extensions',
        path: 'plugin.json#extensions',
        severity: 'warning',
        message: 'Ignored extensions because it is not an object.',
      })
    else
      for (const namespace of Object.keys(raw.extensions))
        issues.push({
          code: 'unsupported_extension',
          path: `plugin.json#extensions/${namespace}`,
          severity: 'unsupported',
          message: `The ${namespace} client extension is retained for inspection but is not loaded by TanChat.`,
        })
  }
  const parsed = manifestSchema.safeParse(
    Object.fromEntries(Object.entries(raw).filter(([key]) => known.has(key))),
  )
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new PluginFormatError(
      `Check plugin.json ${issue?.path.join('.') || 'metadata'}: ${issue?.message || 'invalid value'}`,
    )
  }
  return parsed.data
}

const serverSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('stdio'),
      command: safeText.min(1),
      args: z.array(safeText).optional(),
      env: stringMap.optional(),
      cwd: safeText.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('streamable-http'),
      url: safeText.min(1),
      headers: stringMap.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('sse'),
      url: safeText.min(1),
      headers: stringMap.optional(),
    })
    .strict(),
])

function relativeLocation(value: string): boolean {
  const suffix = value.startsWith('./')
    ? value.slice(2)
    : /^\$\{PLUGIN_(?:ROOT|DATA)\}(?:\/|$)/.test(value)
      ? value.replace(/^\$\{PLUGIN_(?:ROOT|DATA)\}\/?/, '')
      : undefined
  return (
    suffix !== undefined &&
    !suffix.includes('\\') &&
    !suffix.split('/').includes('..') &&
    !suffix.startsWith('/') &&
    !/[\p{Cc}\p{Cf}]/u.test(suffix)
  )
}

function remoteUrl(value: string): URL | undefined {
  try {
    if (!/^https?:\/\//.test(value) || /[\\\s\p{Cc}\p{Cf}]/u.test(value)) return
    const url = new URL(value)
    const loopback =
      url.hostname === 'localhost' ||
      url.hostname === '[::1]' ||
      /^127\./.test(url.hostname)
    if (
      url.username ||
      url.password ||
      url.hash ||
      (url.protocol !== 'https:' && !loopback)
    )
      return
    return url
  } catch {
    return
  }
}

/** TanChat host policy, separate from portable URL validity. Runtime authorization
 * must recheck its public-endpoint rules before binding or contacting a server.
 */
function publicEndpoint(url: URL): boolean {
  const host = url.hostname.replace(/\.$/, '').toLowerCase()
  return (
    url.href.length <= 500 &&
    url.protocol === 'https:' &&
    !url.port &&
    !url.search &&
    host.includes('.') &&
    !host.endsWith('.local') &&
    !host.endsWith('.internal') &&
    !host.endsWith('.localhost') &&
    !/^[\d.]+$/.test(host) &&
    !host.includes(':')
  )
}

function readMcp(
  source: string,
  issues: PluginCompatibilityIssue[],
): PluginMcpServer[] {
  let raw: Record<string, unknown>
  try {
    raw = json(source, 'mcp.json')
    if (
      raw.$schema !== pluginMcpSchemaId ||
      !object(raw.mcpServers) ||
      Object.keys(raw).some((key) => key !== '$schema' && key !== 'mcpServers')
    )
      throw new PluginFormatError(
        'mcp.json needs only the matching Agent Plugins 1.0.0 $schema and an mcpServers object.',
      )
  } catch (error) {
    issues.push({
      code: 'invalid_mcp_configuration',
      path: 'mcp.json',
      severity: 'invalid',
      message:
        error instanceof PluginFormatError ? error.message : 'Check mcp.json.',
    })
    return []
  }
  const entries = Object.entries(raw.mcpServers as Record<string, unknown>)
  if (entries.length > maxPluginMcpServers) {
    issues.push({
      code: 'mcp_limit',
      path: 'mcp.json',
      severity: 'unsupported',
      message:
        'This TanChat release supports up to 32 MCP server requirements per package.',
    })
    return []
  }
  const servers: PluginMcpServer[] = []
  for (const [key, value] of entries) {
    const path = `mcp.json#mcpServers/${key}`
    const problem = (
      code: string,
      message: string,
      severity: PluginCompatibilityIssue['severity'] = 'invalid',
    ) => issues.push({ code, path, severity, message })
    const parsed = serverSchema.safeParse(value)
    if (!parsed.success) {
      problem(
        'invalid_mcp_server',
        'Use an explicit stdio, streamable-http or sse transport with only its documented fields.',
      )
      continue
    }
    const server = parsed.data
    if (
      !key ||
      key.length > 200 ||
      !unicode(key) ||
      /[\p{Cc}\p{Cf}]/u.test(key)
    ) {
      problem(
        'unsupported_mcp_key',
        'TanChat requires a nonempty MCP server key up to 200 characters without control characters.',
        'unsupported',
      )
      continue
    }
    if (server.type === 'stdio') {
      const commandValid = server.command.startsWith('./')
        ? relativeLocation(server.command) && server.command.length > 2
        : !/[\s/\\:$]/.test(server.command)
      if (
        !commandValid ||
        /[\p{Cc}\p{Cf}]/u.test(server.command) ||
        (server.cwd !== undefined && !relativeLocation(server.cwd)) ||
        (server.env &&
          (Object.hasOwn(server.env, 'PLUGIN_ROOT') ||
            Object.hasOwn(server.env, 'PLUGIN_DATA')))
      ) {
        problem(
          'invalid_stdio_configuration',
          'Use one executable token, a contained package/data working directory and no reserved PLUGIN_ROOT or PLUGIN_DATA environment entries.',
        )
        continue
      }
      servers.push({ key, ...server, supported: false })
      problem(
        'unsupported_stdio',
        'TanChat cannot run local MCP commands in the browser or Cloudflare Worker. Use a remote Streamable HTTP server or a future local runner.',
        'unsupported',
      )
      continue
    }
    const url = remoteUrl(server.url)
    if (!url) {
      problem(
        'invalid_mcp_url',
        'Use an absolute HTTPS endpoint without credentials or a fragment. Plain HTTP is valid only for loopback hosts.',
      )
      continue
    }
    const headers = Object.entries(server.headers ?? {})
    const names = headers.map(([name]) => name.toLowerCase())
    if (
      new Set(names).size !== names.length ||
      headers.some(
        ([name, value]) =>
          !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
          /[^\t\x20-\x7e\x80-\xff]/.test(value),
      )
    ) {
      problem(
        'invalid_mcp_headers',
        'Use valid HTTP headers with no duplicate names, regardless of letter case.',
      )
      continue
    }
    let supported = true
    if (server.type === 'sse') {
      supported = false
      problem(
        'unsupported_sse',
        'Legacy HTTP+SSE MCP is not supported. Use Streamable HTTP; an SSE response within that transport is different.',
        'unsupported',
      )
    }
    if (!publicEndpoint(url)) {
      supported = false
      problem(
        'unsupported_mcp_endpoint',
        'TanChat cloud connections require a public HTTPS hostname, no custom port or query parameters, and an endpoint up to 500 characters.',
        'unsupported',
      )
    }
    if (headers.length) {
      supported = false
      problem(
        'unsupported_mcp_headers',
        'TanChat does not apply package HTTP headers. Configure credentials through an explicit connection, never inside a package.',
        'unsupported',
      )
    }
    servers.push({ key, ...server, supported })
  }
  return servers
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    value as Uint8Array<ArrayBuffer>,
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Parse only. No network, resource loading, placeholder expansion or execution.
 * Compatibility is not authorization or proof that remote capabilities work.
 */
export async function parsePluginPackage(
  input: unknown,
): Promise<ParsedPluginPackage> {
  const parsed = pluginFileTableSchema.safeParse(input)
  if (!parsed.success)
    throw new PluginFormatError(
      parsed.error.issues[0]?.message ?? 'Check the package files.',
    )
  const files = parsed.data.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  )
  const byPath = new Map(files.map((file) => [file.path, file.text]))
  const manifestText = byPath.get('plugin.json')
  if (manifestText === undefined)
    throw new PluginFormatError(
      'Choose an Agent Plugins package with plugin.json at its root. Claude and Codex compatibility manifests alone are not supported yet.',
    )
  const issues: PluginCompatibilityIssue[] = []
  const manifest = readManifest(manifestText, issues)
  const skills: ParsedPluginPackage['skills'] = []
  const skillFiles = files.filter(({ path }) =>
    /^skills\/[^/]+\/SKILL\.md$/.test(path),
  )
  const handled = new Set([
    'plugin.json',
    'mcp.json',
    ...skillFiles.map(({ path }) => path),
  ])
  if (byPath.has('skills'))
    issues.push({
      code: 'invalid_skills_location',
      path: 'skills',
      severity: 'invalid',
      message:
        'The skills component must be a directory of skill folders, not a file.',
    })
  else if (skillFiles.length > maxPluginSkills)
    issues.push({
      code: 'skills_limit',
      path: 'skills',
      severity: 'unsupported',
      message: 'This TanChat release supports up to 32 skills per package.',
    })
  else
    for (const file of skillFiles) {
      try {
        const document = parseSkillMarkdown(file.text)
        if (document.name !== file.path.split('/')[1])
          throw new Error(
            'The skill name must match its containing directory name.',
          )
        skills.push({ path: file.path, document })
      } catch (error) {
        issues.push({
          code: 'unsupported_skill',
          path: file.path,
          severity: 'invalid',
          message: `This skill cannot be loaded: ${error instanceof Error ? error.message : 'check its metadata and instructions.'}`,
        })
      }
    }
  let mcpServers: PluginMcpServer[] = []
  if (files.some(({ path }) => path.startsWith('mcp.json/')))
    issues.push({
      code: 'invalid_mcp_location',
      path: 'mcp.json',
      severity: 'invalid',
      message:
        'The MCP component must be the root mcp.json file, not a directory.',
    })
  else if (byPath.has('mcp.json'))
    mcpServers = readMcp(byPath.get('mcp.json')!, issues)
  for (const file of files) {
    if (handled.has(file.path)) continue
    // Ordinary resource/script/example text is readable through the authorized
    // package file tool. File extensions do not request code execution. Only
    // native component declarations have unsupported activation semantics.
    const declaration =
      /^(?:\.claude-plugin\/|\.codex-plugin\/|agents\/[^/]+\.md$|commands\/[^/]+\.md$|\.mcp\.json$|\.app\.json$|\.lsp\.json$|hooks\.json$|hooks\/hooks\.json$)/.test(
        file.path,
      )
    if (declaration)
      issues.push({
        code: 'unsupported_package_declaration',
        path: file.path,
        severity: 'unsupported',
        message:
          'TanChat does not activate this host-specific component declaration. The file is retained as readable text, without execution or UI permissions.',
      })
    else if (file.path.endsWith('/SKILL.md'))
      issues.push({
        code: 'undiscovered_skill',
        path: file.path,
        severity: 'warning',
        message:
          'This file is readable as a resource but is not registered as a skill. Put skill entry points directly under skills/<name>/SKILL.md.',
      })
  }
  const count =
    skills.length + mcpServers.filter((server) => server.supported).length
  if (!count)
    issues.push({
      code: 'no_supported_components',
      path: 'plugin.json',
      severity: 'unsupported',
      message:
        'No supported skills or remote MCP requirements were found. The package can be inspected but has no available capabilities.',
    })
  const entries = await Promise.all(
    files.map(async ({ path, text }) => {
      const bytes = encoder.encode(text)
      return [path, bytes.byteLength, await sha256(bytes)] as const
    }),
  )
  // TanChat's integrity receipt, not a signature or an Agent Plugins version field.
  const digest =
    'sha256:' +
    (await sha256(
      encoder.encode(JSON.stringify(['gum-plugin-files-v1', entries])),
    ))
  return {
    format: 'agent-plugins',
    schemaVersion: '1.0.0',
    manifest,
    files,
    digest,
    skills,
    mcpServers,
    compatibility: {
      status: !count
        ? 'unsupported'
        : issues.some((issue) => issue.severity !== 'warning')
          ? 'partial'
          : 'supported',
      issues,
    },
  }
}
