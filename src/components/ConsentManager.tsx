import * as React from 'react'
import {
  ConsentManagerProvider,
  IABConsentBanner,
  IABConsentDialog,
} from '@c15t/react'
import { googleTagManager } from '@c15t/scripts/google-tag-manager'
import { getConsentSSRData } from '~/utils/consent.server'

const BACKEND_URL = 'https://consent-io-eu-west-1-tanstack.c15t.dev'

export function ConsentManager({ children }: { children: React.ReactNode }) {
  const [ssrData] = React.useState(() => getConsentSSRData())

  return (
    <ConsentManagerProvider
      options={{
        mode: 'c15t',
        backendURL: BACKEND_URL,
        iab: {
          enabled: true,
        },
        legalLinks: {
          privacyPolicy: {
            label: 'Privacy Policy',
            href: '/privacy',
          },
        },
        scripts: [googleTagManager({ id: 'GTM-5N57KQT4' })],
        ssrData,
      }}
    >
      <IABConsentBanner />
      <IABConsentDialog />
      {children}
    </ConsentManagerProvider>
  )
}
