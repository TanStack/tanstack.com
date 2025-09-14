import { convexQuery } from '@convex-dev/react-query'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { ErrorComponent } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Authenticated } from 'convex/react'
import React from 'react'
import { FaSpinner } from 'react-icons/fa'
import { SignInForm } from '~/routes/_libraries/login'

const baseClasses = 'p-4 flex flex-col items-center justify-center gap-4'

export function ClientAuth({
  children,
}: {
  children:
    | React.ReactNode
    | ((userQuery: UseQueryResult<any>) => React.ReactNode)
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
        const canAdmin = userQuery.data?.capabilities.includes('admin')

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
  children: (userQuery: UseQueryResult<any>) => React.ReactNode
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
