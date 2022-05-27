import { fetchCached } from '~/utils/cache'
import { getSponsorsTable } from './airtable'
import { GITHUB_ORG, graphqlWithAuth, octokit } from './github'
import { getGithubTiersWithMeta, getTierById, updateTiersMeta } from './tiers'

export type Sponsor = {}

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
  let sponsors: Sponsor = []

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
}

async function getSponsorsMeta() {
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
}

export async function getSponsorsForSponsorPack() {
  let { sponsors } = await fetchCached({
    key: 'sponsors',
    ttl: 60 * 60 * 1000,
    fn: getSponsorsAndTiers,
  })

  return sponsors.filter((d) => d.privacyLevel === 'PUBLIC')
}
