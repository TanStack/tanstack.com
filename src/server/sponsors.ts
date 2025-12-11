import { fetchCached } from '~/utils/cache.server'
import { graphqlWithAuth } from '~/server/github'
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

export const getSponsorsForSponsorPack = createServerFn({
  method: 'GET',
}).handler(async () => {
  const sponsors = await fetchCached({
    key: 'sponsors',
    // ttl: process.env.NODE_ENV === 'development' ? 1 : 60 * 60 * 1000,
    ttl: 60 * 1000,
    fn: getSponsors,
  })

  // In recent @tanstack/react-start versions, getEvent is no longer exported.
  // Headers can be set unconditionally here; framework will merge appropriately.
  setResponseHeaders({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
  })

  const amountExtent = extent(sponsors, (d) => d.amount).map((d) => d!)
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

export async function getSponsors() {
  const [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta(),
  ])

  sponsorsMeta.forEach((sponsorMeta: SponsorMeta) => {
    const matchingSponsor = sponsors.find((d) => d.login == sponsorMeta.login)

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

      const {
        viewer: {
          sponsorshipsAsMaintainer: {
            pageInfo: { hasNextPage, endCursor },
            edges,
          },
        },
      } = res as any

      sponsors = [
        ...sponsors,
        ...edges.map((edge: any) => {
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
          }
        }),
      ]

      if (hasNextPage) {
        await fetchPage(endCursor)
      }
    }

    await fetchPage()

    return sponsors.filter(Boolean)
  } catch (err: any) {
    if (err.status === 401) {
      console.error('Missing github credentials, returning mock data.')
      return [
        'tannerlinsley',
        'tkdodo',
        'crutchcorn',
        'kevinvandy',
        'jherr',
        'seancassiere',
        'schiller-manuel',
      ].flatMap((d, i1) =>
        new Array(20).fill(d).map((d, i2) => ({
          login: d,
          name: d,
          amount: (20 - i2) / 20 + Math.random(),
          createdAt: new Date().toISOString(),
          private: false,
          linkUrl: `https://github.com/${d}`,
          imageUrl: `https://github.com/${d}.png`,
        })),
      )
    }
    if (err.status === 403) {
      console.error('GitHub rate limit exceeded, returning empty sponsors.')
      return []
    }
    throw err
  }
}

async function getSponsorsMeta(): Promise<SponsorMeta[]> {
  try {
    return sponsorMetaData.filter((sponsor) => !sponsor.private)
  } catch (err: any) {
    console.error('Error reading sponsor metadata from JSON file:', err)
    return []
  }
}
