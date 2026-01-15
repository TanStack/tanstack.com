import * as React from 'react'
import { redirect, useNavigate, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { createAuthorizationCode } from '~/utils/oauthClient.functions'
import { getCurrentUser } from '~/utils/auth.server'
import { Card } from '~/components/Card'
import { Button } from '~/components/Button'
import { useIsDark } from '~/hooks/useIsDark'
import { BrandContextMenu } from '~/components/BrandContextMenu'

/**
 * Validate redirect URI - must be localhost or HTTPS
 * Inlined here to avoid pulling in server-only dependencies
 */
function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    ) {
      return true
    }
    if (url.protocol === 'https:') {
      return true
    }
    return false
  } catch {
    return false
  }
}

const searchSchema = v.object({
  client_id: v.string(),
  redirect_uri: v.string(),
  code_challenge: v.string(),
  code_challenge_method: v.optional(v.string()),
  state: v.optional(v.string()),
  scope: v.optional(v.string()),
  response_type: v.optional(v.string()),
})

export const Route = createFileRoute('/oauth/authorize')({
  component: AuthorizePage,
  validateSearch: searchSchema,

  loaderDeps: ({ search }) => ({
    client_id: search.client_id,
    redirect_uri: search.redirect_uri,
    code_challenge: search.code_challenge,
    code_challenge_method: search.code_challenge_method,
    state: search.state,
    scope: search.scope,
    response_type: search.response_type,
  }),
  loader: async ({ deps }) => {
    // Validate required params
    if (!deps.client_id || !deps.redirect_uri || !deps.code_challenge) {
      return {
        error: 'Missing required parameters',
        errorDescription:
          'client_id, redirect_uri, and code_challenge are required',
      }
    }

    // Validate response_type if provided
    if (deps.response_type && deps.response_type !== 'code') {
      return {
        error: 'unsupported_response_type',
        errorDescription: 'Only response_type=code is supported',
      }
    }

    // Validate code_challenge_method
    if (deps.code_challenge_method && deps.code_challenge_method !== 'S256') {
      return {
        error: 'invalid_request',
        errorDescription: 'Only code_challenge_method=S256 is supported',
      }
    }

    // Validate redirect_uri
    if (!validateRedirectUri(deps.redirect_uri)) {
      return {
        error: 'invalid_request',
        errorDescription: 'redirect_uri must be localhost or HTTPS',
      }
    }

    // Check if user is logged in
    const user = await getCurrentUser()

    if (!user) {
      // Build the current URL with all params to redirect back after login
      const currentUrl = new URL('/oauth/authorize', 'https://tanstack.com')
      currentUrl.searchParams.set('client_id', deps.client_id)
      currentUrl.searchParams.set('redirect_uri', deps.redirect_uri)
      currentUrl.searchParams.set('code_challenge', deps.code_challenge)
      if (deps.code_challenge_method) {
        currentUrl.searchParams.set(
          'code_challenge_method',
          deps.code_challenge_method,
        )
      }
      if (deps.state) {
        currentUrl.searchParams.set('state', deps.state)
      }
      if (deps.scope) {
        currentUrl.searchParams.set('scope', deps.scope)
      }

      throw redirect({
        to: '/login',
        search: {
          redirect: currentUrl.pathname + currentUrl.search,
        },
      })
    }

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
      },
      clientId: deps.client_id,
      redirectUri: deps.redirect_uri,
      codeChallenge: deps.code_challenge,
      codeChallengeMethod: deps.code_challenge_method || 'S256',
      state: deps.state,
      scope: deps.scope || 'api',
    }
  },
})

function SplashImage() {
  const isDark = useIsDark()

  return (
    <div className="flex items-center justify-center mb-4">
      <BrandContextMenu className="cursor-pointer">
        <img
          src={
            isDark
              ? '/images/logos/splash-dark.png'
              : '/images/logos/splash-light.png'
          }
          alt="TanStack"
          className="w-24 h-24"
        />
      </BrandContextMenu>
    </div>
  )
}

function AuthorizePage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Handle error state
  if ('error' in data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <SplashImage />
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Authorization Error
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {data.error}: {data.errorDescription}
          </p>
        </Card>
      </div>
    )
  }

  const handleAuthorize = async () => {
    setIsSubmitting(true)

    try {
      // Create authorization code via server function
      const result = await createAuthorizationCode({
        data: {
          clientId: data.clientId,
          redirectUri: data.redirectUri,
          codeChallenge: data.codeChallenge,
          codeChallengeMethod: data.codeChallengeMethod,
          scope: data.scope,
        },
      })

      // Build redirect URL with code
      const redirectUrl = new URL(data.redirectUri)
      redirectUrl.searchParams.set('code', result.code)
      if (data.state) {
        redirectUrl.searchParams.set('state', data.state)
      }

      window.location.href = redirectUrl.toString()
    } catch {
      setIsSubmitting(false)
    }
  }

  const handleDeny = () => {
    // Redirect back with error
    const redirectUrl = new URL(data.redirectUri)
    redirectUrl.searchParams.set('error', 'access_denied')
    redirectUrl.searchParams.set(
      'error_description',
      'User denied the authorization request',
    )
    if (data.state) {
      redirectUrl.searchParams.set('state', data.state)
    }
    window.location.href = redirectUrl.toString()
  }

  // Format client ID for display (often looks like a technical identifier)
  const displayClientId = data.clientId.replace(/-/g, ' ').replace(/_/g, ' ')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full">
        <SplashImage />

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
          Authorize {displayClientId}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
          This application wants to access the TanStack API on your behalf.
        </p>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            This will allow the app to:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              Search and read TanStack documentation
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              List libraries and get NPM stats
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">&#10003;</span>
              Get ecosystem partner recommendations
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleAuthorize}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Authorizing...' : 'Authorize'}
          </Button>
          <Button
            onClick={handleDeny}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-6">
          Signed in as {data.user.email}
          <br />
          <button
            onClick={() => navigate({ to: '/auth/signout' })}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Not you? Sign out
          </button>
        </p>
      </Card>
    </div>
  )
}
