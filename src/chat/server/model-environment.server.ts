import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { RunModelError, type ModelEnvironment } from './run-models'
export async function getModelEnvironment(): Promise<ModelEnvironment> {
  const env = await getHostRuntimeEnv()
  const key = env?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY
  const model = env?.INCLUDED_MODEL ?? process.env.INCLUDED_MODEL
  if (typeof key !== 'string' || !key)
    throw new RunModelError(
      'Provider credential storage is not configured.',
      503,
    )
  if (typeof model !== 'string' || !model.trim())
    throw new RunModelError('The included model is not configured.', 503)
  return { ENCRYPTION_KEY: key, INCLUDED_MODEL: model }
}
