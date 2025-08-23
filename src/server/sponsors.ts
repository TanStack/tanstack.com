import { fetchCached } from '~/utils/cache.server'
import { getSponsorsTable } from '~/server/airtable'
import { GITHUB_ORG, graphqlWithAuth, octokit } from '~/server/github'
import {
  getGithubTiersWithMeta,
  getTierById,
  updateTiersMeta,
} from '~/server/tiers'
import { createServerFn } from '@tanstack/react-start'
import { getEvent, setHeaders } from '@tanstack/react-start/server'

export type Sponsor = {
  login: string
  name: string
  email: string
  imageUrl: string
  linkUrl: string
  privacyLevel: string
  tier: {
    id: string
    monthlyPriceInDollars: number
    meta: {
      githubTeamSlug: string
    }
  }
  createdAt: string
}

// const teamsBySponsorType = {
//   fan: 'Fan',
//   supporter: 'Supporter',
//   premierSponsor: 'Premier Sponsor',
// }

export async function sponsorCreated({ login, newTier }) {
  // newTier = await getTierById(newTier.id)

  await inviteAllSponsors()

  // if (newTier.meta.githubTeamSlug) {
  //   await octokit.teams.addOrUpdateMembershipForUserInOrg({
  //     org: GITHUB_ORG,
  //     team_slug: newTier.meta.githubTeamSlug,
  //     username: login,
  //   })

  //   console.info(`invited user:${login} to team:${newTier.meta.githubTeamSlug}`)
  // }
}

export async function sponsorEdited({ login, oldTier, newTier }) {
  oldTier = await getTierById(oldTier.id)
  // newTier = await getTierById(newTier.id)

  await octokit.teams.removeMembershipForUserInOrg({
    org: GITHUB_ORG,
    team_slug: oldTier.meta.githubTeamSlug,
    username: login,
  })
  console.info(`removed user:${login} from team:${oldTier.meta.githubTeamSlug}`)

  await inviteAllSponsors()
  // await octokit.teams.addOrUpdateMembershipForUserInOrg({
  //   org: GITHUB_ORG,
  //   team_slug: newTier.meta.githubTeamSlug,
  //   username: login,
  // })
  // console.info(`invited user:${login} to team:${newTier.meta.githubTeamSlug}`)
}

export async function sponsorCancelled({ login, oldTier }) {
  oldTier = await getTierById(oldTier.id)
  await octokit.teams.removeMembershipForUserInOrg({
    org: GITHUB_ORG,
    team_slug: oldTier.meta.githubTeamSlug,
    username: login,
  })
  console.info(`removed user:${login} from team:${oldTier.meta.githubTeamSlug}`)
}

async function inviteAllSponsors() {
  let { sponsors } = await getSponsorsAndTiers()

  await Promise.all(
    sponsors.map(async (sponsor) => {
      await octokit.teams.addOrUpdateMembershipForUserInOrg({
        org: GITHUB_ORG,
        team_slug: sponsor.tier.meta.githubTeamSlug,
        username: sponsor.login,
      })
    })
  )
}

export async function getSponsorsAndTiers() {
  const tiers = await getGithubTiersWithMeta()
  await updateTiersMeta(tiers)

  let [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta().then((all) => all.map((d) => d.fields)),
  ])

  sponsors = sponsors.map((d) => ({
    ...d,
    tier: tiers.find((tier) => tier.id == d.tier.id),
  }))

  sponsorsMeta.forEach((sponsorMeta) => {
    const matchingSponsor = sponsors.find((d) => d.login == sponsorMeta.login)

    if (matchingSponsor) {
      Object.assign(matchingSponsor, {
        name: sponsorMeta.name ?? matchingSponsor.name,
        email: sponsorMeta.email ?? matchingSponsor.email,
        imageUrl: sponsorMeta.imageUrl ?? matchingSponsor.imageUrl,
        linkUrl: sponsorMeta.linkUrl ?? matchingSponsor.linkUrl,
        privacyLevel: sponsorMeta.privacyLevel ?? matchingSponsor.privacyLevel,
      })
    } else {
      const tier = tiers.find((d) => d.id === sponsorMeta.tierId?.[0])
      sponsors.push({
        ...sponsorMeta,
        tier,
      })
    }
  })

  sponsors.sort(
    (a, b) =>
      b.monthlyPriceInDollars - a.monthlyPriceInDollars ||
      (b.createdAt > a.createdAt ? -1 : 1)
  )

  return {
    sponsors,
    tiers,
  }
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
                  id
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
      } = res

      sponsors = [
        ...sponsors,
        ...edges.map((edge) => {
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
            tier,
            createdAt,
            privacyLevel,
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

async function getSponsorsMeta() {
  try {
    const sponsorsTable = await getSponsorsTable()

    return new Promise((resolve, reject) => {
      let allSponsors = []
      sponsorsTable.select().eachPage(
        function page(records, fetchNextPage) {
          allSponsors = [...allSponsors, ...records]
          fetchNextPage()
        },
        function done(err) {
          if (err) {
            reject(err)
          } else {
            resolve(allSponsors)
          }
        }
      )
    })
  } catch (err: any) {
    if (err.message === 'An API key is required to connect to Airtable') {
      console.error('Missing airtable credentials, returning mock data.')

      return []
    }
    throw err
  }
}

export const getSponsorsForSponsorPack = createServerFn({
  method: 'GET',
}).handler(async () => {
  let { sponsors } = (await fetchCached({
    key: 'sponsors',
    // ttl: process.env.NODE_ENV === 'development' ? 1 : 60 * 60 * 1000,
    ttl: 60 * 1000,
    fn: getSponsorsAndTiers,
  })) as { sponsors: Sponsor[] }

  if (!getEvent().handled) {
    setHeaders({
      'cache-control': 'public, max-age=0, must-revalidate',
      'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    })
  }

  return sponsors
    .filter((d) => d.privacyLevel === 'PUBLIC')
    .map((d) => ({
      linkUrl: d.linkUrl,
      login: d.login,
      imageUrl: d.imageUrl,
      name: d.name,
      tier: {
        monthlyPriceInDollars: d.tier?.monthlyPriceInDollars,
      },
    }))
})
