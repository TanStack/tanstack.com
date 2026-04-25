import * as React from 'react'
import { authClient } from '~/auth/client'
// Using public asset URLs for splash images
import { redirect, createFileRoute } from '@tanstack/react-router'
import { getCurrentUser } from '~/utils/auth.functions'
import * as v from 'valibot'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { GoogleIcon } from '~/components/icons/GoogleIcon'
import { Card } from '~/components/Card'

const LazyBrandContextMenu = React.lazy(() =>
  import('~/components/BrandContextMenu').then((m) => ({
    default: m.BrandContextMenu,
  })),
)

const searchSchema = v.object({
  error: v.optional(v.string()),
  redirect: v.optional(v.string()),
})

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: searchSchema,
  loader: async () => {
    // Call server function directly from loader (works in both SSR and client)
    const user = await getCurrentUser()
    if (user) {
      throw redirect({ to: '/account' })
    }
  },
})

function SplashImage() {
  return (
    <div className="flex items-center justify-center mb-4">
      <React.Suspense
        fallback={
          <div className="cursor-pointer">
            <img
              src="/images/logos/splash-light.png"
              alt="TanStack"
              className="w-48 h-48 dark:hidden"
            />
            <img
              src="/images/logos/splash-dark.png"
              alt="TanStack"
              className="w-48 h-48 hidden dark:block"
            />
          </div>
        }
      >
        <LazyBrandContextMenu className="cursor-pointer">
          <img
            src="/images/logos/splash-light.png"
            alt="TanStack"
            className="w-48 h-48 dark:hidden"
          />
          <img
            src="/images/logos/splash-dark.png"
            alt="TanStack"
            className="w-48 h-48 hidden dark:block"
          />
        </LazyBrandContextMenu>
      </React.Suspense>
    </div>
  )
}

export function SignInForm({ returnTo }: { returnTo?: string } = {}) {
  return (
    <Card className="p-8 w-[100vw] max-w-sm mx-auto">
      <SplashImage />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Sign into TanStack
      </h2>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'github',
            returnTo,
          })
        }
        className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors"
      >
        <GithubIcon className="inline-block mr-2 -mt-0.5" /> Sign in with GitHub
      </button>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'google',
            returnTo,
          })
        }
        className="w-full bg-[#DB4437]/95 hover:bg-[#DB4437] text-white font-semibold py-2 px-4 rounded-md transition-colors mt-4"
      >
        <GoogleIcon className="inline-block mr-2 -mt-0.5" /> Sign in with Google
      </button>
    </Card>
  )
}

function LoginPage() {
  const { error } = Route.useSearch()

  const errorMessages: Record<string, string> = {
    oauth_failed: 'Authentication failed. Please try again.',
  }

  const errorMessage = error
    ? errorMessages[error] || 'An error occurred. Please try again.'
    : null

  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          <SignInForm />
        </div>
      </div>
    </div>
  )
}
