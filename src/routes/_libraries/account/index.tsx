import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { authClient } from '~/utils/auth.client'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useToast } from '~/components/ToastProvider'
import { updateAdPreference } from '~/utils/users.server'
import { getMyStreak } from '~/utils/activity.functions'
import { LogOut, Flame, Trophy, Calendar } from 'lucide-react'
import { Card } from '~/components/Card'

export const Route = createFileRoute('/_libraries/account/')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const userQuery = useCurrentUserQuery()
  const capabilities = useCapabilities()
  const { notify } = useToast()
  const navigate = useNavigate()

  const streakQuery = useQuery({
    queryKey: ['my-streak'],
    queryFn: () => getMyStreak(),
    enabled: !!userQuery.data,
  })

  // Get values directly from the current user data
  const user = userQuery.data
  const adsDisabled =
    user && typeof user === 'object' && 'adsDisabled' in user
      ? (user.adsDisabled ?? false)
      : false
  const canDisableAds =
    capabilities.includes('admin') || capabilities.includes('disableAds')

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
    <Card className="p-4 flex flex-col gap-y-6 max-w-lg">
      <div>
        <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
          Connections
        </h3>
        <div className="flex flex-col gap-y-4 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="font-medium">
              Email
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md py-1 px-2 w-full max-w-xs"
              value={
                user && typeof user === 'object' && 'email' in user
                  ? (user.email ?? '')
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
      <div>
        <h3 className="font-bold mb-2 text-lg text-gray-900 dark:text-white">
          Activity
        </h3>
        {streakQuery.isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : streakQuery.data ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Flame className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.currentStreak}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Current Streak
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.longestStreak}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Best Streak
              </span>
            </div>
            <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-500 mb-1" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {streakQuery.data.totalActiveDays}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Active Days
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="">
        <button
          onClick={signOut}
          className="text-sm flex gap-2 items-center font-medium bg-black/80 hover:bg-black text-white dark:bg-white/95 dark:hover:bg-white dark:text-black py-1.5 px-2 rounded-md transition-colors my-4"
        >
          <LogOut /> Logout
        </button>
      </div>
    </Card>
  )
}
