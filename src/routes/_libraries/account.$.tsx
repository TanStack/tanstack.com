import * as React from 'react'
import {
  SignedIn,
  SignedOut,
  UserProfile,
  SignInButton,
  SignOutButton,
  useUser,
} from '@clerk/tanstack-react-start'
import { useUserSettingsStore } from '~/stores/userSettings'
import { FaSignOutAlt } from 'react-icons/fa'

export const Route = createFileRoute({
  component: AccountPage,
})

function AccountPage() {
  const { isLoaded } = useUser()
  const adsDisabled = useUserSettingsStore((s) => s.settings.adsDisabled)
  const toggleAds = useUserSettingsStore((s) => s.toggleAds)

  return (
    <div className="min-h-screen mx-auto p-4 md:p-8 w-full">
      <SignedIn>
        <div className="space-y-2">
          <UserProfile path="/account" />
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600 my-1"
                  checked={adsDisabled}
                  onChange={toggleAds}
                  disabled={!isLoaded}
                  aria-label="Disable Ads"
                />
                <div>
                  <div className="font-semibold">Disable Ads</div>
                  <div className="text-sm opacity-70">
                    Hide ads when you are signed in
                  </div>
                </div>
              </label>
            </div>
          </div>
          <SignOutButton>
            <button className="flex gap-2 items-center text-xs bg-gray-500 hover:bg-red-500 text-white font-black uppercase py-2 px-4 rounded-md transition-colors">
              <FaSignOutAlt /> Log Out
            </button>
          </SignOutButton>
        </div>
      </SignedIn>

      <SignedOut>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sign In Required
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Please sign in to access your account settings.
          </p>
          <SignInButton mode="modal">
            <button className="text-sm uppercase font-black bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  )
}
