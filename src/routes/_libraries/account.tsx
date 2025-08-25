import { FaSignOutAlt } from 'react-icons/fa'
import { Authenticated, Unauthenticated, useMutation } from 'convex/react'
import { Link, redirect } from '@tanstack/react-router'
import { authClient } from '~/utils/auth.client'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute({
  component: AccountPage,
})

function UserSettings() {
  const userQuery = useCurrentUserQuery()
  // Use current user query directly instead of separate ad preference query
  const updateAdPreferenceMutation = useMutation(
    api.users.updateAdPreference
  ).withOptimisticUpdate((localStore, args) => {
    const { adsDisabled } = args
    const currentValue = localStore.getQuery(api.auth.getCurrentUser)
    if (currentValue !== undefined) {
      localStore.setQuery(api.auth.getCurrentUser, {}, {
        ...currentValue,
        adsDisabled: adsDisabled,
      } as any)
    }
  })

  // Get values directly from the current user data
  const adsDisabled = userQuery.data?.adsDisabled ?? false
  const canDisableAds =
    userQuery.data?.capabilities.includes('disableAds') ?? false

  const handleToggleAds = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAdPreferenceMutation({
      adsDisabled: e.target.checked,
    })
  }

  const signOut = async () => {
    await authClient.signOut()
    redirect({ to: '/login' })
  }

  return (
    <>
      <div className="flex flex-col gap-y-6 max-w-lg">
        <h2 className="text-2xl font-semibold lg:-mt-4 lg:-mb-2">My Account</h2>
        <div className="dark:bg-black/30 bg-white rounded-lg shadow-lg p-4 flex flex-col gap-y-6 max-w-lg">
          <div>
            <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
              Connections
            </h3>
            <div className="flex flex-col gap-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <label className="font-medium">Email</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-md py-1 px-2 w-full max-w-xs"
                  value={userQuery.data?.email ?? ''}
                  disabled
                />
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
              Preferences
            </h3>
            {canDisableAds ? (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600 my-1"
                    checked={adsDisabled}
                    onChange={handleToggleAds}
                    disabled={userQuery.isLoading}
                    aria-label="Disable Ads"
                  />
                  <div>
                    <div className="font-medium">Disable Ads</div>
                    <div className="text-sm opacity-70">
                      Hide ads when you are signed in
                    </div>
                  </div>
                </label>
              </div>
            ) : null}
          </div>
          <div className="">
            <button
              onClick={signOut}
              className="text-sm flex gap-2 items-center font-medium bg-black/80 hover:bg-black text-white dark:bg-white/95 dark:hover:bg-white dark:text-black py-1.5 px-2 rounded-md transition-colors my-4"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function AccountPage() {
  return (
    <div className="min-h-screen mx-auto p-4 md:p-8 w-full">
      <Authenticated>
        <UserSettings />
      </Authenticated>
      <Unauthenticated>
        <div className="bg-white dark:bg-black/30 rounded-lg shadow-lg p-8 text-center w-[100vw] max-w-sm mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sign In Required
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Please sign in to access your account settings.
          </p>
          <Link to="/login">
            <button className="text-sm font-medium bg-black/80 hover:bg-black text-white dark:text-black dark:bg-white/95 dark:hover:bg-white  py-2 px-4 rounded-md transition-colors">
              Sign In
            </button>
          </Link>
        </div>
      </Unauthenticated>
    </div>
  )
}
