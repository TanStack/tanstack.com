import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { Footer } from '~/components/Footer'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'
import { Copy, Download } from '@phosphor-icons/react'
import { copyTextToClipboard } from '~/utils/browser-effects'

export const Route = createFileRoute('/brand-guide')({
  component: RouteComponent,
  head: () => ({
    meta: seo({
      title: 'Brand Guide | TanStack',
      description:
        'Official TanStack brand assets, logos, splashes, and usage guidelines',
    }),
  }),
})

interface AssetCardProps {
  title: string
  description: string
  asset: React.ReactNode
  url?: string
  bg?: 'light' | 'dark' | 'none'
}

function AssetCard({ title, description, asset, url, bg }: AssetCardProps) {
  const { notify } = useToast()
  const isSvg = !!url && url.toLowerCase().endsWith('.svg')
  const handleDirectDownload = async () => {
    try {
      if (!url) return
      const absoluteUrl = url.startsWith('http')
        ? url
        : new URL(url, window.location.origin).toString()
      const filename = absoluteUrl.split('/').pop() || 'asset'
      const link = document.createElement('a')
      link.href = absoluteUrl
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to download asset', err)
      notify(
        <div>
          <div className="font-medium">Download failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            Try again or use Copy URL
          </div>
        </div>,
      )
    }
  }
  return (
    <div
      className={twMerge(
        `rounded-lg shadow-lg overflow-hidden`,
        bg === 'dark'
          ? 'bg-black/80 text-white'
          : bg === 'light'
            ? 'bg-white text-black'
            : 'bg-gray-500/20',
      )}
    >
      <div
        className={twMerge(
          `p-6  flex items-center justify-center min-h-[200px]`,
        )}
      >
        {asset}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold  mb-2">{title}</h3>
        <p className="text-sm mb-4">{description}</p>
        {url ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDirectDownload}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-700"
              aria-label="Download asset"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (!url) return
                  const absoluteUrl = url.startsWith('http')
                    ? url
                    : new URL(url, window.location.origin).toString()
                  await copyTextToClipboard(absoluteUrl)
                  notify(
                    <div>
                      <div className="font-medium">Copied to clipboard</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        Asset URL is now in your clipboard
                      </div>
                    </div>,
                  )
                } catch (err) {
                  console.error('Failed to copy asset URL', err)
                  notify(
                    <div>
                      <div className="font-medium">Copy failed</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        Try again or download directly from the brand guide
                      </div>
                    </div>,
                  )
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <Copy className="h-3 w-3" />
              Copy URL
            </button>
            {isSvg ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!url) return
                    const res = await fetch(url)
                    const text = await res.text()
                    await copyTextToClipboard(text)
                    notify(
                      <div>
                        <div className="font-medium">Copied to clipboard</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          SVG markup is now in your clipboard
                        </div>
                      </div>,
                    )
                  } catch (err) {
                    console.error('Failed to copy SVG', err)
                    notify(
                      <div>
                        <div className="font-medium">Copy failed</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">
                          Try again or download directly from the brand guide
                        </div>
                      </div>,
                    )
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <Copy className="h-3 w-3" />
                Copy as SVG
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function RouteComponent() {
  const sections = useMemo(
    () => [
      {
        title: 'Landscape Logo',
        items: [
          {
            title: 'Landscape Black (SVG)',
            description: 'Emblem + wordmark on one line, for light backgrounds',
            url: '/images/brand/tanstack-landscape-black.svg',
            bg: 'light',
          },
          {
            title: 'Landscape White (SVG)',
            description: 'Emblem + wordmark on one line, for dark backgrounds',
            url: '/images/brand/tanstack-landscape-white.svg',
            bg: 'dark',
          },
          {
            title: 'Landscape Charcoal (SVG)',
            description: 'Softer charcoal variant for light backgrounds',
            url: '/images/brand/tanstack-landscape-charcoal.svg',
            bg: 'light',
          },
        ],
      },
      {
        title: 'Stacked Logo',
        items: [
          {
            title: 'Stacked Black (SVG)',
            description:
              'Emblem above a two-line wordmark, for light backgrounds',
            url: '/images/brand/tanstack-stacked-black.svg',
            bg: 'light',
          },
          {
            title: 'Stacked White (SVG)',
            description:
              'Emblem above a two-line wordmark, for dark backgrounds',
            url: '/images/brand/tanstack-stacked-white.svg',
            bg: 'dark',
          },
          {
            title: 'Stacked Charcoal (SVG)',
            description: 'Softer charcoal variant for light backgrounds',
            url: '/images/brand/tanstack-stacked-charcoal.svg',
            bg: 'light',
          },
          {
            title: 'Stacked Cream (SVG)',
            description: 'Cream variant for dark or colored backgrounds',
            url: '/images/brand/tanstack-stacked-cream.svg',
            bg: 'dark',
          },
        ],
      },
      {
        title: 'Emblem',
        items: [
          {
            title: 'Emblem Black (SVG)',
            description: 'The palm-island emblem alone, for light backgrounds',
            url: '/images/brand/tanstack-emblem-black.svg',
            bg: 'light',
          },
          {
            title: 'Emblem White (SVG)',
            description: 'The palm-island emblem alone, for dark backgrounds',
            url: '/images/brand/tanstack-emblem-white.svg',
            bg: 'dark',
          },
          {
            title: 'Emblem Charcoal (SVG)',
            description: 'Softer charcoal emblem for light backgrounds',
            url: '/images/brand/tanstack-emblem-charcoal.svg',
            bg: 'light',
          },
          {
            title: 'Emblem Cream (SVG)',
            description: 'Cream emblem for dark or colored backgrounds',
            url: '/images/brand/tanstack-emblem-cream.svg',
            bg: 'dark',
          },
        ],
      },
      {
        title: 'Other Assets',
        items: [
          {
            title: 'Toy Palm Chair Mockup',
            description:
              'A realistic 3D mockup of the Toy Palm Chair that we considered 3D printing for contributors but have yet to find a decent manufacturer or distributor.',
            url: '/images/logos/toy-palm-chair.png',
            bg: 'none',
          },
        ],
      },
    ],
    [],
  )
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              TanStack Brand Guide
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Official TanStack logos, splash images, and brand assets with
              usage guidelines for your projects and materials.
            </p>
          </div>

          {sections.map((section) => (
            <section key={section.title} className="mb-16">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8 text-center">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.items.map((item) => (
                  <AssetCard
                    key={item.title}
                    title={item.title}
                    description={item.description}
                    asset={
                      <img
                        src={item.url}
                        alt={item.title}
                        className={
                          item.title.includes('Splash')
                            ? 'max-w-full h-auto max-h-40'
                            : 'max-w-full h-auto max-h-24'
                        }
                      />
                    }
                    url={item.url}
                    bg={item.bg as 'light' | 'dark' | 'none' | undefined}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Usage Guidelines */}
          <section className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Usage Guidelines
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                These assets are provided for use in connection with TanStack
                projects, educational materials, and promotional content that
                supports the TanStack ecosystem.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  Use assets in their original proportions without distortion
                </li>
                <li>
                  Maintain appropriate spacing around logos (minimum padding
                  equal to the height of the "T" in TanStack)
                </li>
                <li>
                  Use high contrast combinations (light logos on dark
                  backgrounds, dark logos on light backgrounds)
                </li>
                <li>
                  For vector components, you can copy the JSX from our component
                  files in the repository
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
