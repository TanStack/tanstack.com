import { createServerFn } from '@tanstack/react-start'
import { getCookie, getWebRequest } from '@tanstack/react-start/server'
import { fetchSession, getCookieName } from './auth.server'

// Server side session request
export const fetchServerAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const sessionCookieName = await getCookieName()
    const token = getCookie(sessionCookieName)
    const request = getWebRequest()
    const { session } = await fetchSession(request)
    return {
      userId: session?.user.id,
      token,
    }
  }
)
