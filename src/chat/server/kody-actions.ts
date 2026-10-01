import { parse } from '@babel/parser'
import { SetupEvidence } from './setup-evidence'
import { traverseFast } from '@babel/types'
import type { StructuredKodyAction } from '../core/types'
import { z } from 'zod'
const identifier = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
  .refine((value) => !['constructor', 'prototype', '__proto__'].includes(value))
const remoteName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[^\u0000-\u001f\u007f]+$/)
  .refine((value) => !['constructor', 'prototype', '__proto__'].includes(value))
const targetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capability'), id: identifier }).strict(),
  z
    .object({
      kind: z.literal('package'),
      packageId: z.uuid(),
      sourceId: z.uuid(),
      publishedCommit: z.string().regex(/^[a-f0-9]{40}$/),
      importSpecifier: z
        .string()
        .regex(
          /^kody:@[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._/-]+)?$/,
        ),
      exportName: identifier,
    })
    .strict(),
  z
    .object({
      kind: z.literal('mcp'),
      serverId: remoteName,
      serverName: remoteName,
      kodyName: remoteName,
      toolName: remoteName,
    })
    .strict(),
])
const actionSchema = z
  .object({
    version: z.literal(2),
    target: targetSchema,
    input: z.record(z.string(), z.unknown()),
    title: z.string().max(200),
    readOnly: z.boolean().optional(),
  })
  .strict()
export function compileKodyAction(action: unknown) {
  const parsed = actionSchema.parse(action)
  let code: string
  if (parsed.target.kind === 'capability')
    code = `import { kody } from 'kody:runtime'\nexport default async function main(params) { return await kody[${JSON.stringify(parsed.target.id)}](params) }`
  else if (parsed.target.kind === 'package') {
    const rootExport = /^kody:@[^/]+\/[^/]+$/.test(
      parsed.target.importSpecifier,
    )
    code = `${rootExport ? `import * as entry from ${JSON.stringify(parsed.target.importSpecifier)}\n` : ''}import { kody } from 'kody:runtime'
export default async function main(params) {
  const published = await kody.repoShowPublishNote({ package_id: ${JSON.stringify(parsed.target.packageId)} })
  if (published.source_id !== ${JSON.stringify(parsed.target.sourceId)} || published.commit !== ${JSON.stringify(parsed.target.publishedCommit)}) throw new Error('This Kody package changed after its action was prepared. Inspect it again before running it.')
${rootExport ? '' : `  const specifier = ${JSON.stringify(parsed.target.importSpecifier)}\n  const entry = await import(specifier)\n`}
  return await entry[${JSON.stringify(parsed.target.exportName)}](params)
}`
  } else
    code = `import { kody } from 'kody:runtime'\nexport default async function main(params) {
  const listing = await kody.mcpServerList({})
  const server = listing.servers.find(item => item.id === ${JSON.stringify(parsed.target.serverId)})
  if (!server || server.name !== ${JSON.stringify(parsed.target.serverName)} || !server.enabled || !server.connected || server.usageMode !== 'any' || !server.tools.includes(${JSON.stringify(parsed.target.toolName)})) throw new Error('Connected tool unavailable')
  const tools = kody.mcp[${JSON.stringify(parsed.target.kodyName)}]
  if (!tools || typeof tools[${JSON.stringify(parsed.target.toolName)}] !== 'function') throw new Error('Connected tool unavailable')
  return await tools[${JSON.stringify(parsed.target.toolName)}](params)
}`
  return { title: parsed.title, code, params: parsed.input }
}
type CatalogEntry = {
  target: StructuredKodyAction['target']
  title: string
  entityRef: string
  inputType?: string
  requiredFields: string[]
  allowedFields?: string[]
  emptyInput: boolean
  readOnly: boolean
}

/** Only enforce field names when Kody documents a plain object input type. */
function documentedInputFields(definition?: string): string[] | undefined {
  if (!definition) return
  try {
    const ast = parse(definition, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const alias = ast.program.body.find(
      (node) => node.type === 'TSTypeAliasDeclaration',
    )
    if (!alias || alias.type !== 'TSTypeAliasDeclaration') return
    const type = alias.typeAnnotation
    if (type.type !== 'TSTypeLiteral') return
    const fields: string[] = []
    for (const member of type.members) {
      if (member.type !== 'TSPropertySignature') return
      if (member.key.type === 'Identifier') fields.push(member.key.name)
      else if (member.key.type === 'StringLiteral')
        fields.push(member.key.value)
      else return
    }
    return fields
  } catch {
    return
  }
}
const detailSchema = z
  .object({
    kind: z.literal('entity'),
    type: z.string(),
    id: z.string(),
    entityRef: z.string(),
    title: z.string().optional(),
    readOnly: z.boolean().optional(),
    source: z.string().optional(),
    inputTypeDefinition: z.string().optional(),
    requiredInputFields: z.array(z.string()).optional(),
    importSpecifier: z.string().optional(),
    sourceId: z.uuid().optional(),
    publishedCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    mcpServer: z
      .object({
        serverId: z.string(),
        serverName: z.string(),
        kodyName: z.string(),
        mcpToolName: z.string(),
        toolName: z.string(),
      })
      .optional(),
    functions: z
      .array(
        z.object({
          name: z.string(),
          title: z.string().optional(),
          typeDefinition: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough()
// Kody accepts package export subpaths with './' but emits canonical subpaths
// without it. These identify the same inspected export, not a different action.
const canonicalEntity = (ref: string) =>
  ref.startsWith('package:') ? ref.replace('#./', '#') : ref
/** Normalize protocol contracts. No capability names or service workflows live here. */
export class KodyActionCatalog {
  private actions = new Map<string, CatalogEntry>()
  private inspections = new Map<string, string[]>()
  constructor(
    private origin = 'https://kody.codes',
    private evidence = new SetupEvidence(),
  ) {}
  register(response: unknown, inspectedRef: string) {
    const key = canonicalEntity(inspectedRef)
    for (const actionId of this.inspections.get(key) ?? [])
      this.actions.delete(actionId)
    this.inspections.set(key, [])
    // Inspection evidence is useful even when the server supplies prose rather
    // than a structured executable contract. Never turn prose into an action.
    const inspected = z
      .object({
        isError: z.boolean().optional(),
        content: z
          .array(z.object({ type: z.string(), text: z.string().optional() }))
          .optional(),
      })
      .safeParse(response)
    this.evidence.forget(inspectedRef)
    if (inspected.success && !inspected.data.isError) {
      const text = (inspected.data.content ?? [])
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text)
      if (text.length) this.evidence.register(inspectedRef, text, this.origin)
    }
    const envelope = z
      .object({
        isError: z.boolean().optional(),
        structuredContent: z.object({ result: z.unknown() }),
      })
      .safeParse(response)
    if (!envelope.success || envelope.data.isError) return []
    const result = envelope.data.structuredContent.result
    const rows = Array.isArray(result) ? result : [result]
    const registered = []
    for (const row of rows) {
      const parsed = detailSchema.safeParse(row)
      if (!parsed.success) continue
      const detail = parsed.data
      if (canonicalEntity(detail.entityRef) !== key) continue
      // Only explicit inspection contributes evidence, never user/model text.
      this.evidence.register(inspectedRef, row, this.origin)
      const targets: Array<{
        target: unknown
        title?: string
        inputType?: string
      }> = []
      if (detail.type === 'capability' && detail.source === 'builtin')
        targets.push({
          target: { kind: 'capability', id: detail.id },
          inputType: detail.inputTypeDefinition,
        })
      if (
        detail.type === 'capability' &&
        detail.source === 'mcp-server' &&
        detail.mcpServer &&
        detail.entityRef === `capability:${detail.id}`
      )
        targets.push({
          target: {
            kind: 'mcp',
            serverId: detail.mcpServer.serverId,
            serverName: detail.mcpServer.serverName,
            kodyName: detail.mcpServer.kodyName,
            toolName: detail.mcpServer.mcpToolName,
          },
          inputType: detail.inputTypeDefinition,
        })
      if (
        detail.type === 'package' &&
        detail.importSpecifier &&
        detail.sourceId &&
        detail.publishedCommit
      )
        for (const fn of detail.functions ?? [])
          targets.push({
            target: {
              kind: 'package',
              packageId: detail.id,
              sourceId: detail.sourceId,
              publishedCommit: detail.publishedCommit,
              importSpecifier: detail.importSpecifier,
              exportName: fn.name,
            },
            title: fn.title,
            inputType: fn.typeDefinition,
          })
      for (const candidate of targets) {
        const target = targetSchema.safeParse(candidate.target)
        if (!target.success) continue
        const entry: CatalogEntry = {
          target: target.data,
          title: candidate.title ?? detail.title ?? detail.id,
          entityRef: detail.entityRef,
          inputType: candidate.inputType,
          requiredFields: detail.requiredInputFields ?? [],
          allowedFields: documentedInputFields(candidate.inputType),
          readOnly: detail.type === 'capability' && detail.readOnly === true,
          emptyInput: /^type\s+\w+\s*=\s*Record<string,\s*never>\s*;?$/.test(
            candidate.inputType?.trim() ?? '',
          ),
        }
        const actionId = crypto.randomUUID()
        this.actions.set(actionId, entry)
        this.inspections.get(key)!.push(actionId)
        registered.push({
          actionId,
          ...entry,
          requiresApproval: true,
          validation: entry.emptyInput
            ? 'empty-object'
            : entry.allowedFields
              ? 'documented-fields'
              : 'required-fields-only',
          note: 'Plain object field names and required fields are checked here. TypeScript text is not a complete runtime validator; Kody validates the operation. This handle does not prove permissions or model-free dependencies.',
        })
      }
    }
    return registered
  }
  hasInspected(entity: string) {
    return this.inspections.has(canonicalEntity(entity))
  }
  selectEntity(
    entity: string,
    operation: string | undefined,
    input: unknown,
  ): StructuredKodyAction {
    const ids = this.inspections.get(canonicalEntity(entity))
    if (!ids) throw new Error('Inspect this Kody entity before proposing it.')
    const available = ids
      .map((id) => ({ id, entry: this.actions.get(id) }))
      .filter((item): item is { id: string; entry: CatalogEntry } =>
        Boolean(item.entry),
      )
    const matching = available.filter(({ entry }) =>
      entry.target.kind === 'package'
        ? operation == null || entry.target.exportName === operation
        : operation == null,
    )
    if (!matching.length)
      throw new Error(
        'No supported action matches this Kody entity and operation.',
      )
    if (matching.length > 1)
      throw new Error(
        `Choose one package operation: ${matching
          .map(({ entry }) =>
            entry.target.kind === 'package' ? entry.target.exportName : '',
          )
          .join(', ')}.`,
      )
    return this.select(matching[0]!.id, input)
  }
  select(actionId: string, input: unknown): StructuredKodyAction {
    const entry = this.actions.get(actionId)
    if (!entry)
      throw new Error('Inspect an action in this turn before selecting it.')
    const args = z.record(z.string(), z.unknown()).parse(input)
    if (entry.emptyInput && Object.keys(args).length)
      throw new Error('This action takes an empty input object.')
    if (entry.requiredFields.some((key) => !Object.hasOwn(args, key)))
      throw new Error('The action is missing required inputs.')
    const unsupported = entry.allowedFields
      ? Object.keys(args).filter((key) => !entry.allowedFields!.includes(key))
      : []
    if (unsupported.length)
      throw new Error(
        `The action input has unsupported fields: ${unsupported.join(', ')}. Documented fields: ${entry.allowedFields!.join(', ') || 'none'}.`,
      )
    const action: StructuredKodyAction = {
      version: 2,
      target: entry.target,
      title: entry.title,
      input: args,
      ...(entry.readOnly ? { readOnly: true } : {}),
    }
    compileKodyAction(action)
    return action
  }
  setupLink(evidenceRef: string, raw: string) {
    return this.evidence.resolve(evidenceRef, raw)
  }
}

/** Validate the executable module contract without running generated code. */
export function validateKodyExecution(code: string) {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript'] })
  traverseFast(ast, (node) => {
    const source =
      node.type === 'ImportExpression'
        ? node.source
        : node.type === 'CallExpression' && node.callee.type === 'Import'
          ? node.arguments[0]
          : undefined
    if (source?.type === 'StringLiteral' && source.value.startsWith('kody:')) {
      throw new Error(
        'Kody execution does not support dynamic imports of literal kody: specifiers. Use a top-level static import, for example: import action from "kody:@example/package/action". Call the imported function inside the default export.',
      )
    }
  })
  const entry = ast.program.body.find(
    (node) => node.type === 'ExportDefaultDeclaration',
  )
  if (
    !entry ||
    entry.type !== 'ExportDefaultDeclaration' ||
    ![
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
    ].includes(entry.declaration.type)
  ) {
    throw new Error(
      'Kody execution code must default export a function directly. Put calls inside it, for example: export default async function main(params) { return await action(params) }. Do not export the result of calling a function.',
    )
  }
}
