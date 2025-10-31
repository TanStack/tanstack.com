import { authClient } from '~/utils/auth.client'
import { useIsDark } from '~/hooks/useIsDark'
import { FaGithub, FaGoogle } from 'react-icons/fa'
// Using public asset URLs for splash images
import { BrandContextMenu } from '~/components/BrandContextMenu'
import { redirect, createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { convexQuery } from '@convex-dev/react-query'
import { z } from 'zod'

export const Route = createFileRoute('/_libraries/login')({
  component: LoginPage,
  validateSearch: z.object({
    redirectTo: z.string().optional(),
  }),
  beforeLoad: async ({ context }) => {
    if (context.userId) {
      throw redirect({ to: '/account' })
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentUser, {})
    )
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
          alt="Waitlist"
          className="w-48 h-48"
        />
      </BrandContextMenu>
    </div>
  )
}

export function SignInForm() {
  const { redirectTo = '/account' } = Route.useSearch()
  return (
    <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 w-[100vw] max-w-sm mx-auto">
      <SplashImage />
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
        Sign into TanStack
      </h2>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'github',
            callbackURL: redirectTo,
          })
        }
        className="w-full bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white font-semibold py-2 px-4 rounded-md transition-colors"
      >
        <FaGithub className="inline-block mr-2" /> Sign in with GitHub
      </button>
      <button
        onClick={() =>
          authClient.signIn.social({
            provider: 'google',
            callbackURL: redirectTo,
          })
        }
        className="w-full bg-[#DB4437]/95 hover:bg-[#DB4437] text-white font-semibold py-2 px-4 rounded-md transition-colors mt-4"
      >
        <FaGoogle className="inline-block mr-2" /> Sign in with Google
      </button>
    </div>
  )
}

function LoginPage() {
  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <SignInForm />
        </div>
      </div>
    </div>
  )
}
