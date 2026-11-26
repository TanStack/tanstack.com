import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import {
  kodyResourceKindSchema,
  kodyResourcePageSchema,
  type KodyResourceKind,
} from '../core/kody-resources'
import { kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceScope,
  type KodyReferenceOptions,
} from './kody-reference-access'
import { KodyRunError } from './kody-run'

// Project inside Kody so credential-like fields never cross the host boundary.
export const KODY_RESOURCES_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const specs = {
    subscriptions: ['packageSubscriptionsList', 'subscriptions', ['package_id','name','topic','handler','description']],
    webhooks: ['webhookList', 'webhooks', ['package_id','package_name','name','export_name','description','minted','enabled','response_mode']],
    secrets: ['secretList', 'secrets', ['name','scope','package_id','description','allowed_hosts','expires_at']],
    'secret-providers': ['secretProviderList', 'bindings', ['provider','package_id','door_secret_name']],
    shared: ['packageShareList', 'grants', ['grant_id','package_id','package_name','owner_username','grantee_username','invitee_username','status','role','trust_level','pin_ahead','direction']]
  }
  const spec = specs[params.kind]
  if (!spec) throw new Error('Unsupported resource')
  const response = params.kind === 'shared'
    ? {grants: (await Promise.all(['inbound','outbound'].map(async direction => {
        const result = await kody.packageShareList({scope:direction})
        if (!Array.isArray(result.grants)) throw new Error('Unsupported shares')
        return result.grants.map(grant => ({...grant,direction}))
      }))).flat()}
    : await kody[spec[0]]({})
  const rows = response[spec[1]]
  if (!Array.isArray(rows)) throw new Error('Unsupported resource list')
  return { rows: rows.slice(0, 200).map(row => Object.fromEntries(spec[2].map(key => [key, row[key]]))), limited: rows.length > 200 }
}`

const text = z.string().max(2000)
const common = { package_id: text.nullish(), description: text.nullish() }
const rowSchemas = {
  subscriptions: z.object({
    ...common,
    name: text,
    topic: text,
    handler: text,
  }),
  webhooks: z.object({
    ...common,
    package_name: text,
    name: text,
    export_name: text,
    minted: z.boolean(),
    enabled: z.boolean().nullable(),
    response_mode: text,
  }),
  secrets: z.object({
    ...common,
    name: text,
    scope: text,
    allowed_hosts: z.array(text).max(200),
    expires_at: text.nullish(),
  }),
  'secret-providers': z.object({
    provider: text,
    package_id: text,
    door_secret_name: text,
  }),
  shared: z.object({
    grant_id: text,
    package_id: text,
    package_name: text,
    owner_username: text,
    grantee_username: text.nullish(),
    invitee_username: text.nullish(),
    status: text,
    role: text,
    trust_level: text.nullish(),
    pin_ahead: z.boolean(),
    direction: z.enum(['inbound', 'outbound']),
  }),
}
export function projectKodyResources(kind: KodyResourceKind, raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          rows: z.array(z.unknown()).max(200),
          limited: z.boolean(),
        }),
      }),
    })
    .parse(raw)
  if (envelope.isError)
    throw new KodyRunError('Kody could not read these resources.')
  const { rows, limited } = envelope.structuredContent.result
  const labels: Record<string, string> = {
    name: 'Package',
    package_name: 'Package',
    topic: 'Event',
    handler: 'Handler',
    description: 'Description',
    export_name: 'Export',
    response_mode: 'Response',
    scope: 'Scope',
    allowed_hosts: 'Allowed hosts',
    expires_at: 'Expires',
    door_secret_name: 'Credential reference',
    owner_username: 'Owner',
    grantee_username: 'Shared with',
    invitee_username: 'Invited user',
    status: 'Status',
    role: 'Access',
    trust_level: 'Updates',
    pin_ahead: 'Update awaiting approval',
    direction: 'Direction',
  }
  return kodyResourcePageSchema.parse({
    limited,
    items: rows.map((row) => {
      const value = rowSchemas[kind].parse(row) as Record<string, unknown>
      const name = String(
        value.provider ??
          (kind === 'shared' ? value.package_name : undefined) ??
          (kind === 'subscriptions' ? value.topic : value.name),
      )
      const fields = Object.entries(value).flatMap(([key, val]) => {
        if (
          !(key in labels) ||
          val == null ||
          val === '' ||
          (key === 'name' && kind !== 'subscriptions')
        )
          return []
        return [
          {
            label: labels[key],
            value: Array.isArray(val)
              ? val.join(', ').slice(0, 2000)
              : String(val),
          },
        ]
      })
      if (kind === 'webhooks')
        fields.unshift({
          label: 'Status',
          value: !value.minted
            ? 'Not activated'
            : value.enabled
              ? 'Enabled'
              : 'Disabled',
        })
      return {
        id: JSON.stringify([
          kind,
          value.grant_id ?? null,
          value.direction ?? null,
          value.package_id ?? null,
          value.scope ?? null,
          name,
          value.handler ?? null,
        ]),
        name,
        packageId: value.package_id ?? null,
        fields,
      }
    }),
  })
}
export async function readKodyResources(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  kind: KodyResourceKind,
  signal: AbortSignal,
) {
  kodyResourceKindSchema.parse(kind)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled) throw new KodyRunError('Kody is unavailable here.', 403)
  const raw = await kodyCall(
    env,
    scope.userId,
    'execute',
    kodyInternalReadArgs({
      code: KODY_RESOURCES_CODE,
      params: { kind },
      responseLimit: 500000,
    }),
    signal,
  )
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  try {
    return projectKodyResources(kind, raw)
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new KodyRunError('Kody returned an unsupported resource response.')
    throw error
  }
}
