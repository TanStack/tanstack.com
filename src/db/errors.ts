// Only return fixed labels. Driver errors can contain SQL parameters, credentials,
// and visitor data, including when Drizzle wraps them in an Error.cause.
export function databaseFailureKind(error: unknown): string {
  for (let depth = 0; depth < 5; depth++) {
    if (typeof error !== 'object' || error === null) break
    const code = 'code' in error ? error.code : undefined
    if (code === 'CONNECT_TIMEOUT' || code === 'ETIMEDOUT')
      return 'connection_timeout'
    if (
      code === 'CONNECTION_CLOSED' ||
      code === 'CONNECTION_ENDED' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === '08006'
    )
      return 'connection_lost'
    if (code === '53300') return 'too_many_connections'
    if (code === '57014') return 'query_cancelled'
    if (code === '40P01') return 'deadlock'
    if (error instanceof Error) {
      if (
        error.message === 'Connection terminated due to connection timeout' ||
        error.message === 'timeout exceeded when trying to connect'
      )
        return 'connection_timeout'
      if (
        error.message === 'Connection terminated unexpectedly' ||
        error.message === 'Network connection lost.'
      )
        return 'connection_lost'
    }
    error = 'cause' in error ? error.cause : undefined
  }
  return 'unknown'
}
