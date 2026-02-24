import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { fetchSSRData } from '@c15t/react/server'

const BACKEND_URL = 'https://consent-io-eu-west-1-tanstack.c15t.dev'

export const getConsentSSRData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    return fetchSSRData({
      backendURL: BACKEND_URL,
      headers: request.headers,
    })
  },
)
