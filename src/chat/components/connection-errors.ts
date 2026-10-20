import { ApiError } from './WorkspaceApi'

export function definiteConnectionRejection(cause: unknown) {
  return (
    cause instanceof ApiError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 408 &&
    cause.status !== 429
  )
}
