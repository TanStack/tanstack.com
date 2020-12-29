import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { tw } from 'twind'

const links = [
  { href: 'https://github.com/tannerlinsley', label: 'GitHub' },
  { href: 'https://discord.com/invite/WrRKjPJ', label: 'Discord' },
]

export default function Nav() {
  return (
    <nav className={tw`max-w-screen-md mx-auto text-white`}>
      <ul className={tw`flex items-center justify-between p-8`}>
        <li>
          <Link href="/">
            <a>
              <Image
                src="/img/logo-white.svg"
                alt="TanStack Logo"
                width={100}
                height={20}
              />
            </a>
          </Link>
        </li>
        <ul className={tw`flex items-center justify-between space-x-2`}>
          {links.map(({ href, label }) => (
            <li key={`${href}${label}`}>
              <Link href={href}>
                <a
                  href={href}
                  className={tw`inline px-2 py-1 rounded-md transition-all hover:(bg-gray-900 bg-opacity-20)`}
                >
                  {label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </ul>
    </nav>
  )
}
