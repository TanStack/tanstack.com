import React from 'react'
import { FaGithub, FaGoogle, FaUser } from 'react-icons/fa'

interface UserProfileProps {
  user?: {
    name?: string | null
    image?: string | null
    email: string
    id: string
  } | null
}

export function UserProfile({ user }: UserProfileProps) {
  if (!user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500 dark:text-gray-400">
          No user data available
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center gap-4">
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'User avatar'}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
            <FaUser className="w-8 h-8 text-gray-600 dark:text-gray-300" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {user.name || 'User'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Profile Information
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {user.name || 'Not provided'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {user.email}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              User ID
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
              {user.id}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Connected Accounts
        </h3>
        <div className="space-y-2">
          {/* We could show connected OAuth providers here */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FaGithub />
            <span>GitHub account connected</span>
          </div>
        </div>
      </div>
    </div>
  )
}
