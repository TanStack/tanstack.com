import * as React from 'react'
import {
  ClientOnly,
  redirect,
  useNavigate,
  createFileRoute,
} from '@tanstack/react-router'
import * as v from 'valibot'
import { SITE_URL } from '~/utils/site'
import {
  createAuthorizationCode,
  validateAuthorizationRequest,
} from '~/utils/oauthClient.functions'
import { getCurrentUser } from '~/utils/auth.functions'
import { Card } from '~/components/Card'
import { Button } from '~/ui'
import { BrandContextMenu } from '~/components/BrandContextMenu'

function SplashImages() {
  return (
    <>
      <img
        src="/images/brand/tanstack-emblem-black.svg"
        alt="TanStack"
        className="w-24 h-24 dark:hidden"
      />
      <img
        src="/images/brand/tanstack-emblem-white.svg"
        alt="TanStack"
        aria-hidden="true"
        className="w-24 h-24 hidden dark:block"
      />
    </>
  )
}

/**
 * Validate redirect URI - must be localhost or HTTPS
 * Inlined here to avoid pulling in server-only dependencies
 */
function validateRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (url.username || url.password) {
      return false
    }

    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    ) {
      return url.protocol === 'http:' || url.protocol === 'https:'
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
  client_id: v.optional(v.pipe(v.string(), v.maxLength(8192))),
  redirect_uri: v.optional(v.pipe(v.string(), v.maxLength(2048))),
  code_challenge: v.optional(v.pipe(v.string(), v.maxLength(256))),
  code_challenge_method: v.optional(v.pipe(v.string(), v.maxLength(32))),
  state: v.optional(v.pipe(v.string(), v.maxLength(2048))),
  scope: v.optional(v.pipe(v.string(), v.maxLength(512))),
  response_type: v.optional(v.pipe(v.string(), v.maxLength(64))),
  resource: v.optional(v.pipe(v.string(), v.maxLength(2048))),
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
    resource: search.resource,
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

    const checked = await validateAuthorizationRequest({
      data: {
        clientId: deps.client_id,
        redirectUri: deps.redirect_uri,
        resource: deps.resource,
        scope: deps.scope,
      },
    })
    if (
      !checked.valid ||
      (deps.resource &&
        (deps.code_challenge_method !== 'S256' ||
          deps.response_type !== 'code')) ||
      !/^[A-Za-z0-9_-]{43}$/.test(deps.code_challenge)
    )
      return {
        error: 'invalid_request',
        errorDescription:
          'Check the registered client, resource, scope and S256 challenge.',
      }

    // Check if user is logged in
    const user = await getCurrentUser()

    if (!user) {
      // Build the current URL with all params to redirect back after login
      const currentUrl = new URL('/oauth/authorize', 'https://tanstack.com')
      currentUrl.searchParams.set('client_id', deps.client_id)
      currentUrl.searchParams.set('redirect_uri', deps.redirect_uri)
      currentUrl.searchParams.set('code_challenge', deps.code_challenge)
      if (deps.resource) currentUrl.searchParams.set('resource', deps.resource)
      if (deps.response_type)
        currentUrl.searchParams.set('response_type', deps.response_type)
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
      scope: checked.scope,
      resource: deps.resource,
      clientName: checked.clientName,
    }
  },
})

function SplashImage() {
  const fallback = (
    <div className="cursor-pointer">
      <SplashImages />
    </div>
  )

  return (
    <div className="flex items-center justify-center mb-4">
      <ClientOnly fallback={fallback}>
        <BrandContextMenu showTrigger className="cursor-pointer">
          <SplashImages />
        </BrandContextMenu>
      </ClientOnly>
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
          resource: data.resource,
        },
      })

      // Build redirect URL with code
      const redirectUrl = new URL(data.redirectUri)
      redirectUrl.searchParams.set('code', result.code)
      redirectUrl.searchParams.set('iss', SITE_URL)
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
    redirectUrl.searchParams.set('iss', SITE_URL)
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
  const displayClientId = data.clientName

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full">
        <SplashImage />

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
          Authorize {displayClientId}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
          {data.scope === 'source'
            ? 'This app can read and change TanStack Source repositories with your permissions.'
            : data.scope === 'identity'
              ? 'Share your TanStack account ID, name, email and linked GitHub identity to sign in.'
              : 'This app will access the TanStack API on your behalf.'}
        </p>

        {data.scope === 'source' ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Revoke access in your TanStack connected apps.
          </p>
        ) : null}

        {data.scope === 'source' ? (
          <p className="text-sm mb-6">
            <a
              href="https://source.tanstack.com/settings/accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline"
            >
              Connect your TanStack account in Source
            </a>{' '}
            before authorizing this client.
          </p>
        ) : null}

        <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 break-all">
          Returns to {data.redirectUri}
        </p>

        <div className="flex gap-3">
          <Button
            onClick={handleAuthorize}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Authorizing...' : 'Authorize'}
          </Button>
          <Button
            variant="secondary"
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
