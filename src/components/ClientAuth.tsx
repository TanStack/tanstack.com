import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { ErrorComponent } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import React from 'react'
import { FaSpinner } from 'react-icons/fa'
import { SignInForm } from '~/routes/_libraries/login'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'

const baseClasses = 'p-4 flex flex-col items-center justify-center gap-4'

type UserQueryResult = ReturnType<typeof useCurrentUserQuery>

export function ClientAuth({
  children,
}: {
  children: React.ReactNode | ((userQuery: UserQueryResult) => React.ReactNode)
}) {
  return (
    <UserQuery>
      {(userQuery) => {
        if (!userQuery.data) {
          return (
            <div className={baseClasses}>
              You are not authorized to access this page.
              <SignInForm />
            </div>
          )
        }

        return typeof children === 'function' ? children(userQuery) : children
      }}
    </UserQuery>
  )
}

export function ClientAdminAuth({ children }: { children: React.ReactNode }) {
  return (
    <ClientAuth>
      {(userQuery) => {
        const capabilities = userQuery.data?.capabilities || []
        const canAdmin = capabilities.includes('admin')

        if (!canAdmin) {
          return (
            <div className={baseClasses}>
              You do not have sufficient permissions to access this page.
            </div>
          )
        }

        return children
      }}
    </ClientAuth>
  )
}

function UserQuery(props: {
  children: (userQuery: UserQueryResult) => React.ReactNode
}) {
  const userQuery = useQuery(convexQuery(api.auth.getCurrentUser, {}))

  if (userQuery.isLoading) {
    return (
      <div className={baseClasses}>
        <FaSpinner className="animate-spin" />
      </div>
    )
  }

  if (userQuery.isError) {
    return (
      <div className={baseClasses}>
        <ErrorComponent error={userQuery.error} />
      </div>
    )
  }

  return props.children(userQuery)
}
