import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import {
  LuShirt,
  LuShoppingBag,
  LuSmartphone,
  LuTag,
  LuCircle,
} from 'react-icons/lu'
import { PiBaseballCapBold } from 'react-icons/pi'
import { twMerge } from 'tailwind-merge'

export const Route = createFileRoute('/merch')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'TanStack Merch',
      description:
        'Official TanStack merchandise including apparel and stickers.',
    }),
  }),
})

const merchItems = [
  {
    name: 'Apparel',
    description:
      'T-shirts, sweatshirts, hoodies, onesies, hats, totes, and phone cases featuring TanStack designs',
    icons: [
      { Icon: LuShirt, label: 'T-shirts' },
      { Icon: PiBaseballCapBold, label: 'Hats' },
      { Icon: LuShoppingBag, label: 'Totes' },
      { Icon: LuSmartphone, label: 'Phone cases' },
    ],
    href: 'https://cottonbureau.com/people/tanstack',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-500/50 hover:border-blue-500/70',
    hoverShadow: 'hover:shadow-blue-500/20',
  },
  {
    name: 'Stickers & Buttons',
    description:
      'High-quality vinyl stickers and small buttons for your laptop, water bottle, and more',
    icons: [
      { Icon: LuTag, label: 'Stickers' },
      { Icon: LuCircle, label: 'Buttons' },
    ],
    href: 'https://www.stickermule.com/tanstack',
    iconColor: 'text-purple-500',
    borderColor: 'border-purple-500/50 hover:border-purple-500/70',
    hoverShadow: 'hover:shadow-purple-500/20',
  },
]

function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-4xl mx-auto">
        <header className="">
          <h1 className="text-3xl font-black">TanStack Merch</h1>
          <p className="text-lg mt-4 text-gray-700 dark:text-gray-300">
            Show your support for TanStack with official merchandise. All items
            are sold at cost (supplier price + shipping) with no markup. We do
            not pre-stock inventory and make no profit from merchandise sales.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {merchItems.map((item, i) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={twMerge(
                `border-2 rounded-xl shadow-lg p-8 transition-all duration-300 ease-out
                bg-white/90 dark:bg-black/40 backdrop-blur-sm
                hover:shadow-2xl hover:-translate-y-1
                relative group
                min-h-[280px] flex flex-col`,
                item.borderColor,
                item.hoverShadow
              )}
              style={{
                zIndex: i,
                willChange: 'transform',
              }}
            >
              <div className="flex flex-col items-center justify-center flex-1 gap-4">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {item.icons.map(({ Icon, label }, iconIdx) => (
                    <div
                      key={iconIdx}
                      className="flex flex-col items-center gap-1"
                      title={label}
                    >
                      <Icon className={twMerge('w-10 h-10', item.iconColor)} />
                    </div>
                  ))}
                </div>
                <h2 className="text-2xl font-bold text-center">{item.name}</h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                  {item.description}
                </p>
                <div className="mt-4">
                  <span
                    className={twMerge(
                      `inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                      bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white
                      group-hover:bg-black/10 dark:group-hover:bg-white/20
                      transition-colors`
                    )}
                  >
                    Shop {item.name}
                    <svg
                      className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          ))}
        </section>
      </div>
      <Footer />
    </div>
  )
}
