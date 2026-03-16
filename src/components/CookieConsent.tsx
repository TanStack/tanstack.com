import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '~/ui'

declare global {
  interface Window {
    dataLayer: any[]
    gtag: any
  }
}

const EU_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'CH',
]

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  const consentSettings = (() => {
    if (typeof document === 'undefined') {
      return { analytics: false }
    }
    try {
      const stored = localStorage.getItem('cookie_consent')
      if (!stored) return { analytics: false }
      const parsed = JSON.parse(stored)
      return { analytics: Boolean(parsed.analytics) }
    } catch {
      return { analytics: false }
    }
  })()

  const blockGoogleScripts = () => {
    document.querySelectorAll('script').forEach((script) => {
      if (
        script.src?.includes('googletagmanager.com') ||
        script.textContent?.includes('gtag(')
      ) {
        script.remove()
      }
    })
    document.cookie =
      '_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.google.com'
    document.cookie =
      '_gid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.google.com'
  }

  const restoreGoogleScripts = () => {
    if (!document.querySelector("script[src*='googletagmanager.com']")) {
      const script = document.createElement('script')
      script.src = 'https://www.googletagmanager.com/gtag/js?id=GTM-5N57KQT4'
      script.async = true
      document.body.appendChild(script)
    }
  }

  const updateGTMConsent = (settings: { analytics: boolean }) => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'cookie_consent',
      consent: {
        analytics_storage: settings.analytics ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_personalization: 'denied',
      },
    })

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: settings.analytics ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_personalization: 'denied',
      })
    }

    if (settings.analytics) {
      restoreGoogleScripts()
    } else {
      blockGoogleScripts()
    }
  }

  useEffect(() => {
    const checkLocationAndSetConsent = async () => {
      if (!consentSettings.analytics) {
        try {
          const response = await fetch(
            'https://www.cloudflare.com/cdn-cgi/trace',
          )
          const data = await response.text()
          const country = data.match(/loc=(\w+)/)?.[1]
          const isEU = country ? EU_COUNTRIES.includes(country) : false

          if (isEU) {
            const euConsent = { analytics: false }
            localStorage.setItem('cookie_consent', JSON.stringify(euConsent))
            updateGTMConsent(euConsent)
            setShowBanner(true)
          } else {
            const nonEuConsent = { analytics: true }
            localStorage.setItem('cookie_consent', JSON.stringify(nonEuConsent))
            updateGTMConsent(nonEuConsent)
            setShowBanner(false)
          }
        } catch (error) {
          console.error('Error checking location:', error)
          setShowBanner(true)
        }
      } else {
        updateGTMConsent(consentSettings)
      }
    }

    checkLocationAndSetConsent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const acceptCookies = () => {
    const consent = { analytics: true }
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    updateGTMConsent(consent)
    setShowBanner(false)
  }

  const rejectCookies = () => {
    const consent = { analytics: false }
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    updateGTMConsent(consent)
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-4 z-50
      text-sm gap-2 flex flex-col lg:flex-row [box-shadow:0_0_10px_rgba(0,0,0,0.2)]
      items-center justify-between
      "
    >
      <span className="text-xs">
        We use cookies for analytics to help improve TanStack. See our{' '}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>{' '}
        for details.
      </span>
      <div className="flex gap-2 flex-wrap items-center">
        <Button color="red" onClick={rejectCookies}>
          Reject
        </Button>
        <Button color="emerald" onClick={acceptCookies}>
          Accept
        </Button>
      </div>
    </div>
  )
}
