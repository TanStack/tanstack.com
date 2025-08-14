import React, { useState } from 'react'
import { FaSignOutAlt, FaUser, FaCog } from 'react-icons/fa'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '~/convex/_generated/api'
import { authClient } from '~/lib/auth-client'

export function UserButton() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const user = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}))

  if (!user.data) return null

  const handleSignOut = async () => {
    await authClient.signOut()
    setIsOpen(false)
    await navigate({ to: '/login' })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {user.data.image ? (
          <img
            src={user.data.image}
            alt={user.data.name || 'User avatar'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
            <FaUser className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {user.data.image ? (
                  <img
                    src={user.data.image}
                    alt={user.data.name || 'User avatar'}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                    <FaUser className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.data.name || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {user.data.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="py-2">
              <Link
                to="/account/$"
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
              >
                <FaCog />
                Account Settings
              </Link>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
              >
                <FaSignOutAlt />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
