import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  CaretDownIcon,
  GearIcon,
  LockIcon,
  SignOutIcon,
  SparkleIcon,
  KeyIcon,
} from '@phosphor-icons/react'
import { Avatar } from '~/components/Avatar'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '~/components/Dropdown'

interface AuthenticatedUserMenuProps {
  user: {
    image?: string | null
    oauthImage?: string | null
    name?: string | null
    email?: string | null
  } | null
  canAdmin: boolean
  canApiKeys: boolean
  onSignOut: () => void
}

export function AuthenticatedUserMenu({
  user,
  canAdmin,
  canApiKeys,
  onSignOut,
}: AuthenticatedUserMenuProps) {
  return (
    <Dropdown>
      <DropdownTrigger
        render={
          <div className="flex items-center gap-1 cursor-pointer h-[26px]">
            <Avatar
              image={user?.image}
              oauthImage={user?.oauthImage}
              name={user?.name}
              email={user?.email}
              size="xs"
              className="w-[26px] h-[26px]"
            />
            <CaretDownIcon className="w-3 h-3 opacity-50" />
          </div>
        }
      />
      <DropdownContent align="end">
        <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          {user?.email}
        </div>
        <DropdownSeparator />
        <DropdownItem
          render={
            <Link to="/account" className="flex items-center gap-2">
              <GearIcon className="w-4 h-4" />
              <span>Account</span>
            </Link>
          }
        />
        <DropdownItem
          render={
            <Link to="/account/submissions" className="flex items-center gap-2">
              <SparkleIcon className="w-4 h-4" />
              <span>My Showcases</span>
            </Link>
          }
        />
        {canApiKeys && (
          <DropdownItem
            render={
              <Link
                to="/account/integrations"
                className="flex items-center gap-2"
              >
                <KeyIcon className="w-4 h-4" />
                <span>Integrations</span>
              </Link>
            }
          />
        )}
        {canAdmin && (
          <DropdownItem
            render={
              <Link to="/admin" className="flex items-center gap-2">
                <LockIcon className="w-4 h-4" />
                <span>Admin</span>
              </Link>
            }
          />
        )}
        <DropdownSeparator />
        <DropdownItem onSelect={onSignOut}>
          <SignOutIcon className="w-4 h-4" />
          <span>Sign out</span>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}
