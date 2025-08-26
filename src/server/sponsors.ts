import { fetchCached } from '~/utils/cache.server'
import { graphqlWithAuth } from '~/server/github'
import { createServerFn } from '@tanstack/react-start'
import { getEvent, setHeaders } from '@tanstack/react-start/server'
import sponsorMetaData from '~/utils/gh-sponsor-meta.json'
import { extent, scaleLinear } from 'd3'

export type SponsorMeta = {
  login: string
  name?: string
  email?: string
  imageUrl?: string
  linkUrl?: string
  private?: boolean
  amount?: number
}

export type Sponsor = {
  login: string
  name: string
  email: string
  imageUrl: string
  linkUrl: string
  private: boolean
  amount: number
  createdAt: string
}

export const getSponsorsForSponsorPack = createServerFn({
  method: 'GET',
}).handler(async () => {
  let sponsors = await fetchCached({
    key: 'sponsors',
    // ttl: process.env.NODE_ENV === 'development' ? 1 : 60 * 60 * 1000,
    ttl: 60 * 1000,
    fn: getSponsors,
  })

  if (!getEvent().handled) {
    setHeaders({
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    })
  }

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
  let [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta(),
  ])

  sponsorsMeta.forEach((sponsorMeta: SponsorMeta) => {
    const matchingSponsor = sponsors.find((d) => d.login == sponsorMeta.login)

    if (matchingSponsor) {
      Object.assign(matchingSponsor, {
        name: sponsorMeta.name ?? matchingSponsor.name,
        email: sponsorMeta.email ?? matchingSponsor.email,
        imageUrl: sponsorMeta.imageUrl ?? matchingSponsor.imageUrl,
        linkUrl: sponsorMeta.linkUrl ?? matchingSponsor.linkUrl,
        private: sponsorMeta.private ?? matchingSponsor.private,
      })
    } else if (sponsorMeta.amount) {
      sponsors.push({
        login: sponsorMeta.login,
        name: sponsorMeta.name || '',
        email: sponsorMeta.email || '',
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
      (b.amount || 0) - (a.amount || 0) || (b.createdAt > a.createdAt ? -1 : 1)
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
                    email
                  }
                  ... on Organization {
                    name
                    login
                    email
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
        }
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

          const { name, login, email } = sponsorEntity

          return {
            name,
            login,
            email,
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
      return []
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
