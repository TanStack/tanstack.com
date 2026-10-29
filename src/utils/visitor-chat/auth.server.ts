import { SessionService } from '~/auth/session.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import { visitorChatCookie, visitorChatCookieAge } from './contract'

export async function visitorChatConfig() {
  const env = await getHostRuntimeEnv()
  return {
    enabled:
      (env?.VISITOR_CHAT_ENABLED ?? process.env.VISITOR_CHAT_ENABLED) ===
      'true',
    limiter: env?.VISITOR_CHAT_RATE_LIMITER,
    secret: env?.SESSION_SECRET ?? process.env.SESSION_SECRET,
  }
}
async function cookieService() {
  const { secret } = await visitorChatConfig()
  if (typeof secret !== 'string' || !secret)
    throw new Error('Visitor chat signing is not configured')
  // Separate signing key, so chat cookies cannot be replayed as account sessions.
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`tanstack-visitor-chat-v1:${secret}`),
  )
  const key = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return new SessionService(key, true)
}
export async function chatCookieHeader(chatId: string) {
  const value = await (
    await cookieService()
  ).signCookie({
    userId: chatId,
    expiresAt: Date.now() + visitorChatCookieAge * 1000,
    version: 0,
  })
  return `${visitorChatCookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${visitorChatCookieAge}`
}
export async function chatIdFromCookie(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split('; ')
    .find((part) => part.startsWith(`${visitorChatCookie}=`))
    ?.slice(visitorChatCookie.length + 1)
  if (!value) return null
  return (await (await cookieService()).verifyCookie(value))?.userId ?? null
}
export async function hashChatProof(proof: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(proof),
  )
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
