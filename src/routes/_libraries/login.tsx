import {
  SignedOut,
  SignedIn,
  UserButton,
  Waitlist,
  SignIn,
} from '@clerk/tanstack-react-start'
import * as React from 'react'

export const Route = createFileRoute({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center w-fit">
          <SignedOut>
            <Waitlist />
          </SignedOut>

          <SignedIn>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-center mb-4">
                <UserButton />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                Welcome!
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                You've been approved from the waitlist and have full access to
                TanStack.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/account"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-colors text-center"
                >
                  Account Settings
                </a>
              </div>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  )
}
