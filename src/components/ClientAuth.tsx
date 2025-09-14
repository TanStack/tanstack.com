import { convexQuery } from '@convex-dev/react-query'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { ErrorComponent } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import React from 'react'
import { FaSpinner } from 'react-icons/fa'
import { SignInForm } from '~/routes/_libraries/login'

const baseClasses = 'p-4 flex flex-col items-center justify-center gap-4'

export function ClientAuth({
  children,
}: {
  children: React.ReactNode | (() => React.ReactNode)
}) {
  const userQuery = useQuery(convexQuery(api.auth.getCurrentUser, {}))

  return (
    <AuthLoadingOrError userQuery={userQuery}>
      {() => {
        if (!userQuery.data) {
          return (
            <div className={baseClasses}>
              You are not authorized to access this page
              <SignInForm />
            </div>
          )
        }

        return typeof children === 'function' ? children() : children
      }}
    </AuthLoadingOrError>
  )
}

export function ClientAdminAuth({ children }: { children: React.ReactNode }) {
  const userQuery = useQuery(convexQuery(api.auth.getCurrentUser, {}))

  return (
    <ClientAuth>
      {() => {
        const canAdmin = userQuery.data?.capabilities.includes('admin')

        if (!canAdmin) {
          return (
            <div className={baseClasses}>
              You are not authorized to access this page. Please contact support
              if you think this is an error.
            </div>
          )
        }

        return children
      }}
    </ClientAuth>
  )
}

function AuthLoadingOrError(props: {
  userQuery: UseQueryResult<any>
  children: React.ReactNode | (() => React.ReactNode)
}) {
  if (props.userQuery.isLoading) {
    return (
      <div className={baseClasses}>
        <FaSpinner className="animate-spin" />
      </div>
    )
  }

  if (props.userQuery.isError) {
    return (
      <div className={baseClasses}>
        <ErrorComponent error={props.userQuery.error} />
      </div>
    )
  }

  return typeof props.children === 'function'
    ? props.children()
    : props.children
}
