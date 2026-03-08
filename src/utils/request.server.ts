/**
 * Request utilities for extracting client information.
 */

/**
 * Extract client IP address from request headers.
 * Checks common proxy headers (x-forwarded-for, x-real-ip, cf-connecting-ip).
 *
 * @param request - The incoming request
 * @param fallback - Value to return if no IP found (default: undefined)
 */
export function getClientIp(request: Request): string | undefined
export function getClientIp<T extends string>(
  request: Request,
  fallback: T,
): string
export function getClientIp(
  request: Request,
  fallback?: string,
): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return fallback
}

/**
 * Extract user agent from request headers.
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
