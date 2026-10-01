import { z } from 'zod'
import { Validator } from '@cfworker/json-schema'
import type { CatalogEntry } from '../mcp-catalog'
import {
  functionContractToSchema,
  typeContractToSchema,
} from '../type-contract'
import { compileKodyAction } from '../kody-actions'

export interface KodyCallContract {
  entry: CatalogEntry
  invocation:
    | { kind: 'builtin'; capability: string }
    | {
        kind: 'package'
        importSpecifier: string
        exportName: string
        parameterOrder: string[]
      }
    | {
        kind: 'mcp'
        serverId: string
        serverName: string
        kodyName: string
        toolName: string
      }
}
const packageEvidence = z.object({
  importSpecifier: z.string().regex(/^kody:@[a-zA-Z0-9_-]+\/[a-zA-Z0-9_./-]+$/),
  exportName: z.string().min(1),
  typeDefinition: z.string().min(1),
  referencedTypes: z.array(z.object({ definition: z.string() })).default([]),
})

/** Called only by an explicitly paired integration, not by tool-name guessing. */
export function packageCallContract(entry: CatalogEntry): KodyCallContract {
  const evidence = packageEvidence.parse(
    JSON.parse(entry.discovered?.evidence ?? 'null'),
  )
  if (
    evidence.importSpecifier
      .split('/')
      .some((part) => part === '.' || part === '..')
  )
    throw new Error('Unsupported package import path.')
  const { inputSchema, parameterOrder } = functionContractToSchema(
    evidence.typeDefinition,
    evidence.referencedTypes.map((type) => type.definition),
  )
  return {
    entry: { ...entry, inputSchema },
    invocation: {
      kind: 'package',
      importSpecifier: evidence.importSpecifier,
      exportName: evidence.exportName,
      parameterOrder,
    },
  }
}

export function builtinCallContract(
  entry: CatalogEntry,
  raw: unknown,
): KodyCallContract {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          kind: z.literal('entity'),
          type: z.literal('capability'),
          id: z.string(),
          inputTypeDefinition: z.string(),
        }),
      }),
    })
    .parse(raw)
  const detail = envelope.structuredContent.result
  if (
    envelope.isError ||
    detail.id !== entry.name ||
    !/^[a-zA-Z_$][\w$]*$/.test(detail.id)
  )
    throw new Error('Capability contract identity mismatch.')
  return {
    entry: {
      ...entry,
      inputSchema: typeContractToSchema(detail.inputTypeDefinition),
    },
    invocation: { kind: 'builtin', capability: detail.id },
  }
}

const connectedToolEvidence = z.object({
  source: z.literal('mcp-server'),
  name: z.string(),
  mcpServer: z.object({
    serverId: z.string(),
    serverName: z.string(),
    kodyName: z.string(),
    mcpToolName: z.string(),
    toolName: z.string(),
  }),
})

export function connectedToolCallContract(
  entry: CatalogEntry,
  raw: unknown,
): KodyCallContract {
  const evidence = connectedToolEvidence.parse(
    JSON.parse(entry.discovered?.evidence ?? 'null'),
  )
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          kind: z.literal('entity'),
          type: z.literal('capability'),
          source: z.literal('mcp-server'),
          id: z.string(),
          inputTypeDefinition: z.string(),
          inputSchema: z.record(z.string(), z.unknown()).optional(),
          mcpServer: connectedToolEvidence.shape.mcpServer,
        }),
      }),
    })
    .parse(raw)
  const detail = envelope.structuredContent.result
  if (
    envelope.isError ||
    detail.id !== entry.name ||
    evidence.name !== entry.name ||
    JSON.stringify(detail.mcpServer) !== JSON.stringify(evidence.mcpServer)
  )
    throw new Error('Connected tool identity mismatch.')
  if (
    detail.inputSchema &&
    new TextEncoder().encode(JSON.stringify(detail.inputSchema)).byteLength >
      64_000
  )
    throw new Error('Connected tool schema is too large.')
  return {
    entry: {
      ...entry,
      inputSchema:
        detail.inputSchema ?? typeContractToSchema(detail.inputTypeDefinition),
    },
    invocation: {
      kind: 'mcp',
      serverId: detail.mcpServer.serverId,
      serverName: detail.mcpServer.serverName,
      kodyName: detail.mcpServer.kodyName,
      toolName: detail.mcpServer.mcpToolName,
    },
  }
}

/** Deterministic transport code. Arguments never become source code. Grants are checked by the host. */
export function kodyCallArguments(
  contract: KodyCallContract,
  args: Record<string, unknown>,
) {
  if (
    !contract.entry.inputSchema ||
    !new Validator(contract.entry.inputSchema).validate(args).valid
  )
    throw new Error('Invalid capability arguments.')
  const plan = contract.invocation
  if (plan.kind === 'builtin')
    return {
      code: `import { kody } from 'kody:runtime'\nexport default async function main(params) {\n  if (typeof kody[params.capability] !== 'function') throw new Error('Capability unavailable')\n  return kody[params.capability](params.arguments)\n}`,
      params: { capability: plan.capability, arguments: args },
    }
  if (plan.kind === 'mcp') {
    const compiled = compileKodyAction({
      version: 2,
      title: contract.entry.title,
      target: plan,
      input: args,
    })
    return { code: compiled.code, params: compiled.params }
  }
  return {
    code: `import * as tools from ${JSON.stringify(plan.importSpecifier)}\nexport default async function main(params) {\n  if (!Object.hasOwn(tools, params.exportName) || typeof tools[params.exportName] !== 'function') throw new Error('Export unavailable')\n  return tools[params.exportName](...params.parameterOrder.map(name => Object.hasOwn(params.arguments, name) ? params.arguments[name] : undefined))\n}`,
    params: {
      exportName: plan.exportName,
      parameterOrder: plan.parameterOrder,
      arguments: args,
    },
  }
}

export async function prepareKodyOperation(
  entry: CatalogEntry,
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<import('./contract').PreparedMcpOperation> {
  if (entry.kind !== 'capability' || entry.target.name !== 'execute')
    throw new Error('Unsupported paired capability target.')
  const evidence = z
    .object({
      importSpecifier: z.string().optional(),
      source: z.string().optional(),
      name: z.string().optional(),
      mcpServer: connectedToolEvidence.shape.mcpServer.optional(),
    })
    .passthrough()
    .parse(JSON.parse(entry.discovered?.evidence ?? 'null'))
  let contract: KodyCallContract
  if (evidence.importSpecifier) contract = packageCallContract(entry)
  else if (
    evidence.source === 'mcp-server' &&
    evidence.name === entry.name &&
    evidence.mcpServer
  )
    contract = connectedToolCallContract(
      entry,
      await call('search', { entity: 'capability:' + entry.name }),
    )
  else {
    if (evidence.source !== 'builtin' || evidence.name !== entry.name)
      throw new Error('Unsupported capability provenance.')
    contract = builtinCallContract(
      entry,
      await call('search', { entity: 'capability:' + entry.name }),
    )
  }
  return {
    entry: contract.entry,
    toCall: (args) => ({
      name: 'execute',
      arguments: kodyCallArguments(contract, args),
    }),
  }
}
