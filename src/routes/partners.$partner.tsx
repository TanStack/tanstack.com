import * as React from 'react'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowUpRight, CheckCircle2, CircleDashed } from 'lucide-react'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import { Button } from '~/ui'
import { seo } from '~/utils/seo'
import { PartnerImage, partnerCategoryLabels } from '~/utils/partners'
import { trackEvent } from '~/utils/analytics'
import {
  findPartnerForPage,
  getPartnerJsonLd,
  getPartnerLibraryLabels,
  getPartnerPageCopy,
  getPartnerPageDescription,
  getPartnerPageTitle,
} from '~/utils/partner-pages'

export const Route = createFileRoute('/partners/$partner')({
  loader: ({ params }) => {
    if (!findPartnerForPage(params.partner)) {
      throw notFound()
    }
  },
  head: ({ params }) => {
    const partner = findPartnerForPage(params.partner)

    if (!partner) {
      return {
        meta: seo({
          title: 'Partner Not Found | TanStack',
          description:
            'The requested TanStack partner page could not be found.',
        }),
      }
    }

    return {
      meta: seo({
        title: getPartnerPageTitle(partner),
        description: getPartnerPageDescription(partner),
      }),
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(getPartnerJsonLd(partner)),
        },
      ],
    }
  },
  component: PartnerDetailPage,
})

function PartnerDetailPage() {
  const { partner: partnerId } = Route.useParams()
  const partner = findPartnerForPage(partnerId)

  if (!partner) {
    throw notFound()
  }

  const copy = getPartnerPageCopy(partner)
  const libraries = getPartnerLibraryLabels(partner)
  const isActive = partner.status === 'active'

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: partner.id,
      placement: 'detail',
    })
  }, [partner])

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Link
              to="/partners"
              className="hover:text-blue-500 transition-colors"
            >
              Partners
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">
              {partner.name}
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="grid gap-8 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8 lg:p-10">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300'
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDashed className="h-3.5 w-3.5" />
                    )}
                    {isActive ? 'Current Partner' : 'Previous Partner'}
                  </span>
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {partnerCategoryLabels[partner.category]}
                  </span>
                </div>

                <div>
                  <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white md:text-5xl">
                    {partner.name}
                  </h1>
                  {partner.tagline ? (
                    <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 md:text-xl">
                      {partner.tagline}
                    </p>
                  ) : null}
                </div>

                <p className="max-w-3xl text-base leading-7 text-gray-700 dark:text-gray-300 md:text-lg">
                  {copy.description}
                </p>

                <p className="max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                  {copy.status}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button
                    as="a"
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      let destinationHost: string | undefined
                      try {
                        destinationHost = new URL(partner.href).host
                      } catch {
                        // Bad/relative href — track without host rather than
                        // throwing and dropping the event entirely.
                      }
                      trackEvent('partner_clicked', {
                        partner_id: partner.id,
                        placement: 'detail',
                        destination: 'external',
                        destination_host: destinationHost,
                      })
                    }}
                  >
                    Visit {partner.name}
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button as={Link} to="/partners" variant="ghost">
                    Browse All Partners
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex w-full max-w-xs items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950/40">
                  <PartnerImage config={partner.image} alt={partner.name} />
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <div className="p-6 md:p-8">
                <h2 className="text-2xl font-black text-gray-950 dark:text-white">
                  Why We Like {partner.name}
                </h2>
                <p className="mt-4 text-base leading-7 text-gray-700 dark:text-gray-300">
                  {copy.whyGreat}
                </p>
              </div>
            </Card>

            <Card>
              <div className="p-6 md:p-8">
                <h2 className="text-2xl font-black text-gray-950 dark:text-white">
                  Why It Works Well With TanStack
                </h2>
                <p className="mt-4 text-base leading-7 text-gray-700 dark:text-gray-300">
                  {copy.whyTanStack}
                </p>
              </div>
            </Card>
          </div>

          {(libraries.length > 0 || partner.startDate) && (
            <Card>
              <div className="p-6 md:p-8">
                <h2 className="text-2xl font-black text-gray-950 dark:text-white">
                  Quick Fit
                </h2>
                <div className="mt-5 grid gap-6 md:grid-cols-2">
                  {libraries.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Relevant Libraries
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {libraries.map((library) => (
                          <span
                            key={library}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {library}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {partner.startDate ? (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Partner Window
                      </h3>
                      <p className="mt-3 text-base leading-7 text-gray-700 dark:text-gray-300">
                        {partner.endDate
                          ? `${partner.startDate} - ${partner.endDate}`
                          : `${partner.startDate} - Present`}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
