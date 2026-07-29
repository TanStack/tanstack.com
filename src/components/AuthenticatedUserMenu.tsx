import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  CaretDown,
  Gear,
  Lock,
  SignOut,
  Sparkle,
  Key,
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
      <DropdownTrigger>
        <div className="flex items-center gap-1 cursor-pointer h-[26px]">
          <Avatar
            image={user?.image}
            oauthImage={user?.oauthImage}
            name={user?.name}
            email={user?.email}
            size="xs"
            className="w-[26px] h-[26px]"
          />
          <CaretDown className="w-3 h-3 opacity-50" />
        </div>
      </DropdownTrigger>
      <DropdownContent align="end">
        <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          {user?.email}
        </div>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link to="/account" className="flex items-center gap-2">
            <Gear className="w-4 h-4" />
            <span>Account</span>
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link to="/account/submissions" className="flex items-center gap-2">
            <Sparkle className="w-4 h-4" />
            <span>My Showcases</span>
          </Link>
        </DropdownItem>
        {canApiKeys && (
          <DropdownItem asChild>
            <Link
              to="/account/integrations"
              className="flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Integrations</span>
            </Link>
          </DropdownItem>
        )}
        {canAdmin && (
          <DropdownItem asChild>
            <Link to="/admin" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem onSelect={onSignOut}>
          <SignOut className="w-4 h-4" />
          <span>Sign out</span>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}
