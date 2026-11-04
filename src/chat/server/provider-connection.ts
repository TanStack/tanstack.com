import { connectionSchema, type Policy } from '../core/types'
import { validateEndpoint } from './public-endpoint'
import { updateCredentials } from './credentials'
import type { ModelEnvironment } from './run-models'

export async function saveProviderConnection(
  env: ModelEnvironment,
  userId: string,
  policy: Policy,
  input: unknown,
) {
  const c = connectionSchema.parse(input)
  if (c.provider === 'compatible') validateEndpoint(c.baseUrl)
  if (!policy.allowedProviders.includes(c.provider))
    throw new Error('This provider is restricted by workspace policy.')
  await updateCredentials(env, userId, (saved) => {
    const existing = saved ?? { connection: c, connections: {} }
    const connection = { ...c }
    if (!connection.apiKey)
      connection.apiKey =
        existing.connections?.[connection.provider]?.apiKey ??
        (connection.provider === existing.connection.provider
          ? existing.connection.apiKey
          : undefined)
    if (connection.provider === 'included') {
      delete connection.apiKey
      connection.model = env.INCLUDED_MODEL
    }
    return {
      ...existing,
      connection,
      connections: {
        ...existing.connections,
        [connection.provider]: connection,
      },
    }
  })
  return { ok: true }
}
