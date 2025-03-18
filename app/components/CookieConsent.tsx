import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

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
  const [showSettings, setShowSettings] = useState(false)
  const consentSettings =
    typeof document !== 'undefined'
      ? JSON.parse(localStorage.getItem('cookie_consent') || '{}')
      : { analytics: false, ads: false }

  useEffect(() => {
    const checkLocationAndSetConsent = async () => {
      // Only check location if no consent has been set yet
      if (!consentSettings.analytics && !consentSettings.ads) {
        try {
          const response = await fetch(
            'https://www.cloudflare.com/cdn-cgi/trace'
          )
          const data = await response.text()
          const country = data.match(/loc=(\w+)/)?.[1]
          const isEU = country ? EU_COUNTRIES.includes(country) : false

          if (isEU) {
            // Set default denied consent for EU users
            const euConsent = { analytics: false, ads: false }
            localStorage.setItem('cookie_consent', JSON.stringify(euConsent))
            updateGTMConsent(euConsent)
            setShowBanner(true)
          } else {
            // For non-EU users, set default accepted consent and don't show banner
            const nonEuConsent = { analytics: true, ads: true }
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
  }, [])

  const updateGTMConsent = (settings: { analytics: boolean; ads: boolean }) => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'cookie_consent',
      consent: {
        analytics_storage: settings.analytics ? 'granted' : 'denied',
        ad_storage: settings.ads ? 'granted' : 'denied',
        ad_personalization: settings.ads ? 'granted' : 'denied',
      },
    })

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: settings.analytics ? 'granted' : 'denied',
        ad_storage: settings.ads ? 'granted' : 'denied',
        ad_personalization: settings.ads ? 'granted' : 'denied',
      })
    }

    if (settings.analytics || settings.ads) {
      restoreGoogleScripts()
    } else {
      blockGoogleScripts()
    }
  }

  const acceptAllCookies = () => {
    const consent = { analytics: true, ads: true }
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    updateGTMConsent(consent)
    setShowBanner(false)
  }

  const rejectAllCookies = () => {
    const consent = { analytics: false, ads: false }
    localStorage.setItem('cookie_consent', JSON.stringify(consent))
    updateGTMConsent(consent)
    setShowBanner(false)
  }

  const openSettings = () => setShowSettings(true)
  const closeSettings = () => setShowSettings(false)

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

  return (
    <>
      {showBanner && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-4 z-50
          text-sm gap-2 flex flex-col lg:flex-row [box-shadow:0_0_10px_rgba(0,0,0,0.2)]
          items-center justify-between
          "
        >
          <span className="text-xs">
            We use cookies for site functionality, analytics, and ads{' '}
            <strong>
              (which is a large part of how TanStack OSS remains free forever)
            </strong>
            . See our{' '}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>{' '}
            for details.
          </span>
          <div className="flex gap-2 flex-wrap items-center text-white font-black">
            <button
              onClick={rejectAllCookies}
              className="rounded-md px-2 py-0.5 bg-rose-500 uppercase hover:bg-rose-600"
            >
              Reject All
            </button>
            <button
              onClick={openSettings}
              className="rounded-md px-2 py-0.5 bg-gray-500 uppercase hover:bg-gray-600"
            >
              Customize
            </button>
            <button
              onClick={acceptAllCookies}
              className="rounded-md px-2 py-0.5 bg-emerald-500 uppercase hover:bg-emerald-600"
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Cookie Settings</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  defaultChecked={consentSettings.analytics}
                  onChange={(e) => {
                    const updated = {
                      ...consentSettings,
                      analytics: e.target.checked,
                    }
                    localStorage.setItem(
                      'cookie_consent',
                      JSON.stringify(updated)
                    )
                    updateGTMConsent(updated)
                  }}
                  className="mt-1"
                />
                <div>
                  <div>Analytics</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Track site usage anonymously
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  defaultChecked={consentSettings.ads}
                  onChange={(e) => {
                    const updated = {
                      ...consentSettings,
                      ads: e.target.checked,
                    }
                    if (typeof document !== 'undefined') {
                      localStorage.setItem(
                        'cookie_consent',
                        JSON.stringify(updated)
                      )
                    }
                    updateGTMConsent(updated)
                  }}
                  className="mt-1"
                />
                <div>
                  <div>Advertising</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Show personalized ads
                  </p>
                </div>
              </label>
              <div className="mt-6">
                <button
                  onClick={closeSettings}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
