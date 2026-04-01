import { fetchCachedWithStaleFallback } from '~/utils/cache.server'
import {
  graphqlWithAuth,
  isRecoverableGitHubApiError,
  normalizeGitHubApiError,
} from '~/server/github'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import sponsorMetaData from '~/utils/gh-sponsor-meta.json'
import { extent, scaleLinear } from 'd3'

export type SponsorMeta = {
  login: string
  name?: string
  imageUrl?: string
  linkUrl?: string
  private?: boolean
  amount?: number
}

export type Sponsor = {
  login: string
  name: string
  imageUrl: string
  linkUrl: string
  private: boolean
  amount: number
  createdAt: string
}

const SPONSOR_CACHE_TTL_MS =
  process.env.NODE_ENV === 'development' ? 1 : 5 * 60 * 1000

export const getSponsorsForSponsorPack = createServerFn({
  method: 'GET',
}).handler(async () => {
  let sponsors: Sponsor[]

  try {
    sponsors = await fetchCachedWithStaleFallback({
      key: 'sponsors',
      ttl: SPONSOR_CACHE_TTL_MS,
      fn: getSponsors,
      shouldFallbackToStale: isRecoverableGitHubApiError,
      onStaleFallback: (error) => {
        console.warn(
          '[getSponsorsForSponsorPack] Serving stale sponsors after GitHub failure:',
          {
            message: error instanceof Error ? error.message : String(error),
          },
        )
      },
    })
  } catch (error) {
    if (isRecoverableGitHubApiError(error)) {
      console.warn(
        '[getSponsorsForSponsorPack] Falling back to metadata-only sponsors:',
        {
          message: error.message,
        },
      )
      sponsors = await getSponsorsFromMetadataOnly()
    } else {
      throw error
    }
  }

  // In recent @tanstack/react-start versions, getEvent is no longer exported.
  // Headers can be set unconditionally here; framework will merge appropriately.
  setResponseHeaders(
    new Headers({
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control':
        'public, max-age=300, durable, stale-while-revalidate=300',
    }),
  )

  const amountExtent = extent(sponsors, (d) => d.amount) as [number, number]
  const scale = scaleLinear().domain(amountExtent).range([0, 1])

  return sponsors
    .filter((d) => !d.private)
    .map((d) => ({
      linkUrl: d.linkUrl,
      login: d.login,
      imageUrl: d.imageUrl,
      name: d.name,
      size: scale(d.amount),
    }))
})

function mergeSponsorsWithMetadata(
  sponsors: Sponsor[],
  sponsorsMeta: SponsorMeta[],
) {
  sponsorsMeta.forEach((sponsorMeta: SponsorMeta) => {
    const matchingSponsor = sponsors.find((d) => d.login === sponsorMeta.login)

    if (matchingSponsor) {
      Object.assign(matchingSponsor, {
        name: sponsorMeta.name ?? matchingSponsor.name,
        imageUrl: sponsorMeta.imageUrl ?? matchingSponsor.imageUrl,
        linkUrl: sponsorMeta.linkUrl ?? matchingSponsor.linkUrl,
        private: sponsorMeta.private ?? matchingSponsor.private,
      })
    } else if (sponsorMeta.amount) {
      sponsors.push({
        login: sponsorMeta.login,
        name: sponsorMeta.name || '',
        imageUrl: sponsorMeta.imageUrl || '',
        linkUrl: sponsorMeta.linkUrl || '',
        private: sponsorMeta.private || false,
        createdAt: new Date().toISOString(),
        amount: sponsorMeta.amount || 0,
      })
    }
  })

  sponsors.sort(
    (a, b) =>
      (b.amount || 0) - (a.amount || 0) || (b.createdAt > a.createdAt ? -1 : 1),
  )

  return sponsors
}

export async function getSponsors() {
  const [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta(),
  ])

  return mergeSponsorsWithMetadata(sponsors, sponsorsMeta)
}

async function getSponsorsFromMetadataOnly() {
  return mergeSponsorsWithMetadata([], await getSponsorsMeta())
}

async function getGithubSponsors() {
  let sponsors: Sponsor[] = []
  try {
    const fetchPage = async (cursor = '') => {
      const res = await graphqlWithAuth(
        `
      query ($cursor: String) {
        viewer {
          sponsorshipsAsMaintainer(first: 100, after: $cursor, includePrivate: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                createdAt
                sponsorEntity {
                  ... on User {
                    name
                    login
                  }
                  ... on Organization {
                    name
                    login
                  }
                }
                tier {
                  monthlyPriceInDollars
                }
                privacyLevel
              }
            }
          }
        }
      }
      `,
        {
          cursor,
        },
      )

      type SponsorshipEdge = {
        node: {
          createdAt: string
          sponsorEntity: {
            name: string
            login: string
          } | null
          tier: {
            monthlyPriceInDollars: number
          } | null
          privacyLevel: string
        }
      }

      type GraphQLResponse = {
        viewer: {
          sponsorshipsAsMaintainer: {
            pageInfo: {
              hasNextPage: boolean
              endCursor: string
            }
            edges: Array<SponsorshipEdge>
          }
        }
      }

      const {
        viewer: {
          sponsorshipsAsMaintainer: {
            pageInfo: { hasNextPage, endCursor },
            edges,
          },
        },
      } = res as GraphQLResponse

      const mapped = edges
        .map((edge) => {
          const {
            node: { createdAt, sponsorEntity, tier, privacyLevel },
          } = edge

          if (!sponsorEntity) {
            return null
          }

          const { name, login } = sponsorEntity

          return {
            name,
            login,
            amount: tier?.monthlyPriceInDollars || 0,
            createdAt,
            private: privacyLevel === 'PRIVATE',
            imageUrl: '',
            linkUrl: '',
          }
        })
        .filter((d): d is Sponsor => d !== null)

      sponsors = [...sponsors, ...mapped]

      if (hasNextPage) {
        await fetchPage(endCursor)
      }
    }

    await fetchPage()

    return sponsors
  } catch (error) {
    throw normalizeGitHubApiError(error, 'Fetching GitHub sponsors')
  }
}

async function getSponsorsMeta(): Promise<SponsorMeta[]> {
  try {
    return sponsorMetaData.filter((sponsor) => !sponsor.private)
  } catch (err) {
    console.error('Error reading sponsor metadata from JSON file:', err)
    return []
  }
}
