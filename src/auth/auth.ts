import { createCookie } from '@remix-run/node'
import { redirect } from '@tanstack/react-router'

let secret = process.env.COOKIE_SECRET || 'default'
if (secret === 'default') {
  console.warn(
    '🚨 No COOKIE_SECRET environment variable set, using default. The app is insecure in production.',
  )
  secret = 'default-secret'
}

let cookie = createCookie('auth', {
  secrets: [secret],
  // 30 days
  maxAge: 30 * 24 * 60 * 60,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
})

export async function getAuthFromRequest(
  request: Request,
): Promise<string | null> {
  const c = request.headers.get('Cookie')
  let userId = await cookie.parse(c)
  return userId ?? null
}

export async function setAuthOnResponse(
  response: Response,
  userId: string,
): Promise<Response> {
  let header = await cookie.serialize(userId)
  response.headers.append('Set-Cookie', header)
  return response
}

export async function requireAuthCookie(request: Request) {
  let userId = await getAuthFromRequest(request)
  if (!userId) {
    throw redirect({
      to: '/login',
      headers: {
        'Set-Cookie': await cookie.serialize('', {
          maxAge: 0,
        }),
      },
    })
  }
  return userId
}

export async function redirectIfLoggedInLoader({
  request,
}: {
  request: Request
}) {
  let userId = await getAuthFromRequest(request)
  if (userId) {
    throw redirect({
      to: '/',
    })
  }
  return null
}

export async function redirectWithClearedCookie() {
  return redirect({
    to: '/',
    headers: {
      'Set-Cookie': await cookie.serialize(null, {
        expires: new Date(0),
      }),
    },
  })
}
