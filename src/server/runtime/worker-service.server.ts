import { getHostRuntimeEnv } from './host.server'

type WorkerService = {
  fetch(request: Request): Promise<Response>
}

function isWorkerService(value: unknown): value is WorkerService {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetch' in value &&
    typeof value.fetch === 'function'
  )
}

export async function forwardWorkerRequest(
  name: 'OG' | 'CHAT' | 'STARTER',
  request: Request,
) {
  const env = await getHostRuntimeEnv()
  const service = env?.[name]
  if (!isWorkerService(service))
    throw new Error(`${name} Worker binding is missing`)
  return service.fetch(request)
}
