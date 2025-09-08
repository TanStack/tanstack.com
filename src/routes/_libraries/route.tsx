import * as React from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { CgClose, CgMenuLeft, CgMusicSpeaker } from 'react-icons/cg'
import { MdLibraryBooks, MdLineAxis, MdSupport } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'
import { sortBy } from '~/utils/utils'
// Using public asset URL
import {
  FaCode,
  FaDiscord,
  FaGithub,
  FaInstagram,
  FaLock,
  FaPaintRoller,
  FaSignInAlt,
  FaTshirt,
  FaUser,
  FaUsers,
} from 'react-icons/fa'

import { libraries } from '~/libraries'
import { Scarf } from '~/components/Scarf'
import { ThemeToggle } from '~/components/ThemeToggle'
import { TbBrandBluesky, TbBrandX } from 'react-icons/tb'
import { BiSolidCheckShield } from 'react-icons/bi'
import { SearchButton } from '~/components/SearchButton'
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from 'convex/react'
import { api } from 'convex/_generated/api'
import { PiHammerFill } from 'react-icons/pi'
import { BrandContextMenu } from '~/components/BrandContextMenu'

export const Route = createFileRoute({
  staleTime: Infinity,
  loader: async (ctx) => {
    return {}
  },
  component: () => {
    return (
      <LibrariesLayout>
        <Outlet />
      </LibrariesLayout>
    )
  },
})

export function LibrariesLayout({ children }: { children: React.ReactNode }) {
  const activeLibrary = useLocation({
    select: (location) => {
      return libraries.find((library) => {
        return location.pathname.startsWith(library.to!)
      })
    },
  })

  return (
    <>
      {children}
      {activeLibrary?.scarfId ? <Scarf id={activeLibrary.scarfId} /> : null}
    </>
  )
}
