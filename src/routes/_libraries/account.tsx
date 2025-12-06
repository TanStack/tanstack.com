import { FaSignOutAlt } from 'react-icons/fa'
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '~/utils/auth.client'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useToast } from '~/components/ToastProvider'
import { updateAdPreference } from '~/utils/users.server'
import { requireAuth } from '~/utils/auth.server'

export const Route = createFileRoute('/_libraries/account')({
  component: AccountPage,
  beforeLoad: async () => {
    // Call server function directly from beforeLoad (works in both SSR and client)
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
})

function UserSettings() {
  const userQuery = useCurrentUserQuery()
  const capabilities = useCapabilities()
  const { notify } = useToast()
  const navigate = useNavigate()

  // Get values directly from the current user data
  const user = userQuery.data
  const adsDisabled =
    user && typeof user === 'object' && 'adsDisabled' in user
      ? user.adsDisabled ?? false
      : false
  const canDisableAds = capabilities.includes('disableAds')

  const handleToggleAds = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await updateAdPreference({ data: { adsDisabled: e.target.checked } })
      notify(
        <div>
          <div className="font-medium">Preferences updated</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Ad visibility preference saved
          </div>
        </div>,
      )
    } catch (error) {
      notify(
        <div>
          <div className="font-medium">Error</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Failed to update preferences
          </div>
        </div>,
      )
    }
  }

  const signOut = async () => {
    await authClient.signOut()
    navigate({ to: '/login' })
    notify(
      <div>
        <div className="font-medium">Signed out</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs">
          You have been logged out
        </div>
      </div>,
    )
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
                  value={
                    user && typeof user === 'object' && 'email' in user
                      ? user.email ?? ''
                      : ''
                  }
                  disabled
                />
              </div>
            </div>
          </div>
          {canDisableAds && (
            <div>
              <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
                Preferences
              </h3>
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
            </div>
          )}
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
      <UserSettings />
    </div>
  )
}
