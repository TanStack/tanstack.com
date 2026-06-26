import * as React from 'react'
import type { ReactNode } from 'react'
import {
  ConsentBanner,
  ConsentDialog,
  ConsentManagerProvider,
  type ConsentManagerOptions,
} from '@c15t/react'
import { gtag } from '@c15t/scripts/google-tag'

const C15T_BACKEND_URL = 'https://eager-kayak-phobos-tanstack-com.inth.app'
const GOOGLE_ANALYTICS_ID = 'G-JMT1Z50SPS'
const LEGAL_LINKS: Array<'privacyPolicy' | 'termsOfService'> = [
  'privacyPolicy',
  'termsOfService',
]

const consentManagerOptions = {
  mode: 'hosted',
  backendURL: C15T_BACKEND_URL,
  consentCategories: ['necessary', 'measurement'],
  overrides: import.meta.env.DEV ? { country: 'DE' } : undefined,
  legalLinks: {
    privacyPolicy: {
      href: '/privacy',
      target: '_self',
    },
    termsOfService: {
      href: '/terms',
      target: '_self',
    },
  },
  scripts: [
    gtag({
      id: GOOGLE_ANALYTICS_ID,
      category: 'measurement',
    }),
  ],
} satisfies ConsentManagerOptions

export function ConsentManager({
  children,
  showControls = true,
}: {
  children: ReactNode
  showControls?: boolean
}) {
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  // c15t injects runtime theme styles; mount after hydration so Start's SSR
  // markup stays byte-stable.
  if (!hasMounted) {
    return <>{children}</>
  }

  return (
    <ConsentManagerProvider options={consentManagerOptions}>
      {showControls ? (
        <>
          <ConsentBanner legalLinks={LEGAL_LINKS} />
          <ConsentDialog legalLinks={LEGAL_LINKS} />
        </>
      ) : null}
      {children}
    </ConsentManagerProvider>
  )
}
