import type * as React from 'react'
import { Link } from '@tanstack/react-router'
import { BSkyIcon } from '~/components/icons/BSkyIcon'
import { BrandXIcon } from '~/components/icons/BrandXIcon'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { YouTubeIcon } from '~/components/icons/YouTubeIcon'

interface FooterLink {
  label: string
  to: string
}

interface FooterColumn {
  label: string
  links: Array<FooterLink>
}

const FOOTER_COLUMNS: Array<FooterColumn> = [
  {
    label: 'Libraries',
    links: [
      { label: 'Browse all', to: '/libraries' },
      { label: 'Query', to: '/query/latest' },
      { label: 'Router', to: '/router/latest' },
      { label: 'Start', to: '/start/latest' },
      { label: 'Table', to: '/table/latest' },
      { label: 'Form', to: '/form/latest' },
    ],
  },
  {
    label: 'Blog',
    links: [
      { label: 'Latest posts', to: '/blog' },
      { label: 'Release notes', to: '/blog' },
      { label: 'YouTube', to: 'https://youtube.com/@tan_stack' },
      { label: 'Workshops', to: '/workshops' },
    ],
  },
  {
    label: 'Community',
    links: [
      { label: 'Discord', to: 'https://tlinz.com/discord' },
      { label: 'GitHub', to: 'https://github.com/TanStack' },
      { label: 'Maintainers', to: '/maintainers' },
      { label: 'Contributors', to: '/maintainers' },
      { label: 'Showcase', to: '/showcase' },
    ],
  },
  {
    label: 'Tools',
    links: [
      { label: 'Builder', to: '/builder' },
      { label: 'Stats', to: '/stats/npm' },
    ],
  },
  {
    label: 'Merch',
    links: [
      { label: 'Shop', to: '/shop' },
      { label: 'Cart', to: '/shop/cart' },
    ],
  },
  {
    label: 'Support',
    links: [
      { label: 'Support overview', to: '/support' },
      { label: 'Partners', to: '/partners' },
      { label: 'OSS sponsors', to: '/#sponsors' },
      { label: 'Enterprise support', to: '/paid-support' },
      { label: 'Contact', to: 'mailto:support@tanstack.com' },
      { label: 'Ethos', to: '/ethos' },
      { label: 'Tenets', to: '/tenets' },
      { label: 'Design system', to: '/ds' },
    ],
  },
]

const SOCIAL_LINKS: Array<
  FooterLink & { Icon: React.ComponentType<{ className?: string }> }
> = [
  { label: 'X', to: 'https://x.com/tan_stack', Icon: BrandXIcon },
  {
    label: 'Bluesky',
    to: 'https://bsky.app/profile/tanstack.com',
    Icon: BSkyIcon,
  },
  { label: 'GitHub', to: 'https://github.com/tanstack', Icon: GithubIcon },
  {
    label: 'YouTube',
    to: 'https://youtube.com/@tan_stack',
    Icon: YouTubeIcon,
  },
]

const LEGAL_LINKS: Array<FooterLink> = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
]

function FooterNavLink({ link }: { link: FooterLink }) {
  const external = link.to.startsWith('http') || link.to.startsWith('mailto:')
  const className =
    'text-ds-body-sm text-text-secondary hover:text-text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'

  return external ? (
    <a
      href={link.to}
      target={link.to.startsWith('mailto:') ? undefined : '_blank'}
      rel={link.to.startsWith('mailto:') ? undefined : 'noreferrer'}
      className={className}
    >
      {link.label}
    </a>
  ) : (
    <Link to={link.to} className={className}>
      {link.label}
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="w-full border-t border-border-subtle bg-background-surface">
      <div className="mx-auto max-w-[96rem] px-6 py-12 md:px-10 lg:py-16">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[342px_repeat(6,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-4 xl:col-span-1 xl:mr-[3px] xl:w-[342px] xl:pr-[68px]">
            <Link
              to="/"
              aria-label="TanStack home"
              className="inline-flex focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <span
                aria-hidden="true"
                className="h-[61px] w-[155px] bg-[#121212] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] dark:bg-[#d3ccbb]"
                style={{
                  maskImage: 'url(/images/brand/tanstack-stacked-white.svg)',
                  WebkitMaskImage:
                    'url(/images/brand/tanstack-stacked-white.svg)',
                }}
              />
            </Link>
            <p className="mt-5 w-[199px] text-ds-body-sm text-text-secondary">
              The open source application stack for the web.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.label} aria-label={`${column.label} footer links`}>
              <h2 className="font-ds-display text-ds-heading-5 font-semibold text-text-primary">
                {column.label}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${link.label}-${link.to}`}>
                    <FooterNavLink link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-border-subtle pt-6 text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="font-ds-mono text-ds-mono-xs uppercase tracking-wider">
              &copy; {new Date().getFullYear()} TanStack LLC
            </p>
            <nav aria-label="Legal links">
              <ul className="flex items-center gap-4">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.to}>
                    <FooterNavLink link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <nav aria-label="Social links">
            <ul className="flex flex-wrap items-center gap-2">
              {SOCIAL_LINKS.map(({ label, to, Icon }) => (
                <li key={to}>
                  <a
                    href={to}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`TanStack on ${label}`}
                    className="inline-flex size-10 items-center justify-center rounded-md text-text-secondary hover:bg-background-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <Icon className="size-6" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
