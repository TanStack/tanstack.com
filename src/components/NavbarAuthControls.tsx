import * as React from 'react'
import {
  Gear,
  Key,
  Lock,
  SignIn,
  SignOut,
  Sparkle,
} from '@phosphor-icons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from '~/components/AuthComponents'
import { authClient } from '~/auth/client'
import { ADMIN_ACCESS_CAPABILITIES } from '~/db/types'
import { useToast } from '~/components/ToastProvider'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUser } from '~/hooks/useCurrentUser'

const LazyAuthenticatedUserMenu = React.lazy(() =>
  import('~/components/AuthenticatedUserMenu').then((m) => ({
    default: m.AuthenticatedUserMenu,
  })),
)
const adminCapabilities = new Set<string>(ADMIN_ACCESS_CAPABILITIES)

type NavbarAuthControlsProps = {
  className?: string
}

export function NavbarAuthControls({ className }: NavbarAuthControlsProps) {
  const capabilities = useCapabilities()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { notify } = useToast()

  const canAdmin = capabilities.some((cap) => adminCapabilities.has(cap))

  const canApiKeys = !!user

  const loginButton = (
    <Link
      to="/login"
      aria-label="Log In"
      className={twMerge(
        'flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 whitespace-nowrap',
        'bg-black dark:bg-white text-white dark:text-black',
        'hover:bg-gray-800 dark:hover:bg-gray-200',
        'transition-colors duration-200 text-xs font-medium',
        className,
      )}
    >
      <span className="hidden min-[430px]:inline">Log In</span>
      <SignIn className="size-4" weight="bold" />
    </Link>
  )

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
      <AuthLoading>{loginButton}</AuthLoading>
      <Unauthenticated>{loginButton}</Unauthenticated>
      <Authenticated>
        <React.Suspense fallback={loginButton}>
          <LazyAuthenticatedUserMenu
            user={user ?? null}
            canAdmin={canAdmin}
            canApiKeys={canApiKeys}
            onSignOut={signOut}
          />
        </React.Suspense>
      </Authenticated>
    </>
  )
}

type MobileNavbarAuthControlsProps = {
  onNavigate: () => void
  tabIndex: number
}

export function MobileNavbarAuthControls({
  onNavigate,
  tabIndex,
}: MobileNavbarAuthControlsProps) {
  const capabilities = useCapabilities()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { notify } = useToast()
  const canAdmin = capabilities.some((cap) => adminCapabilities.has(cap))

  const itemClassName =
    'flex w-full items-center gap-3.5 rounded-xl px-3 py-4 text-left font-ds-display text-ds-heading-3 text-[#a3a3a3] transition-colors hover:bg-[#171717] hover:text-white focus-visible:bg-[#171717] focus-visible:text-white focus-visible:outline-none'

  const signOut = async () => {
    onNavigate()
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

  const signIn = (
    <Link
      to="/login"
      tabIndex={tabIndex}
      onClick={onNavigate}
      className={itemClassName}
    >
      <SignIn className="size-8 shrink-0" />
      Sign In
    </Link>
  )

  return (
    <>
      <AuthLoading>{signIn}</AuthLoading>
      <Unauthenticated>{signIn}</Unauthenticated>
      <Authenticated>
        <Link
          to="/account"
          tabIndex={tabIndex}
          onClick={onNavigate}
          className={itemClassName}
        >
          <Gear className="size-8 shrink-0" />
          Account
        </Link>
        <Link
          to="/account/submissions"
          tabIndex={tabIndex}
          onClick={onNavigate}
          className={itemClassName}
        >
          <Sparkle className="size-8 shrink-0" />
          My Showcases
        </Link>
        {user && (
          <Link
            to="/account/integrations"
            tabIndex={tabIndex}
            onClick={onNavigate}
            className={itemClassName}
          >
            <Key className="size-8 shrink-0" />
            Integrations
          </Link>
        )}
        {canAdmin && (
          <Link
            to="/admin"
            tabIndex={tabIndex}
            onClick={onNavigate}
            className={itemClassName}
          >
            <Lock className="size-8 shrink-0" />
            Admin
          </Link>
        )}
        <button
          type="button"
          tabIndex={tabIndex}
          onClick={signOut}
          className={itemClassName}
        >
          <SignOut className="size-8 shrink-0" />
          Sign Out
        </button>
      </Authenticated>
    </>
  )
}
