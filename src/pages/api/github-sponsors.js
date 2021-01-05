import { graphql } from '@octokit/graphql'
import { middleware } from '../../server/middleware'
import { getSponsorsTable, getTiersTable } from '../../utils/airtable'

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_AUTH_TOKEN}`,
  },
})

export default async function handler(req, res) {
  await middleware(req, res)
  let { sponsors, tiers } = await getSponsorsAndTiers()
  sponsors = sponsors.filter((d) => d.privacyLevel === 'PUBLIC')

  res.status(200)
  res.setHeader('Cache-Control', `s-maxage=${60 * 5}, stale-while-revalidate`) // Cache for 5 minutes
  res.json({ sponsors, tiers })
}

async function getSponsorsAndTiers() {
  const tiers = await getGithubTiers()
  await updateAirtableTierReferences(tiers)

  const [sponsors, sponsorsMeta] = await Promise.all([
    getGithubSponsors(),
    getSponsorsMeta().then((all) => all.map((d) => d.fields)),
  ])

  sponsorsMeta.forEach((meta) => {
    const matchingSponsor = sponsors.find((d) => d.login == meta.login)

    if (matchingSponsor) {
      Object.assign(matchingSponsor, {
        logoURL: meta.logoURL,
        linkURL: meta.linkURL,
      })
    } else {
      sponsors.push(meta)
    }
  })

  sponsors.sort(
    (a, b) =>
      b.monthlyPriceInCents - a.monthlyPriceInCents ||
      (b.createdAt > a.createdAt ? -1 : 1)
  )

  return {
    sponsors,
    tiers,
  }
}

async function getGithubSponsors() {
  let sponsors = []

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
                sponsor {
                  name
                  login
                }
                tier {
                  id
                  monthlyPriceInCents
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
          node: {
            createdAt,
            sponsor,
            tier: { id: tierId, monthlyPriceInCents },
            privacyLevel,
          },
        } = edge

        if (!sponsor) {
          return null
        }

        const { name, login } = sponsor

        return {
          name,
          login,
          tierId,
          createdAt,
          monthlyPriceInCents,
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

async function getGithubTiers() {
  const res = await graphqlWithAuth(
    `query {
      viewer {
        sponsorshipsAsMaintainer(first: 1) {
          nodes {
            sponsorable {
              sponsorsListing {
                tiers(first: 100) {
                  nodes {
                    id
                    name
                    description
                    descriptionHTML
                    monthlyPriceInCents
                  }
                }
              }
            }
          }
        }
      }
    }`
  )

  return res.viewer.sponsorshipsAsMaintainer.nodes[0].sponsorable
    .sponsorsListing.tiers.nodes
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

async function updateAirtableTierReferences(newTiers) {
  const tiersTable = await getTiersTable()

  const tiers = await new Promise((resolve, reject) => {
    let allTiers = []
    tiersTable.select().eachPage(
      function page(records, fetchNextPage) {
        allTiers = [...allTiers, ...records]
        fetchNextPage()
      },
      function done(err) {
        if (err) {
          reject(err)
        } else {
          resolve(allTiers)
        }
      }
    )
  })

  await Promise.all(
    tiers.map((tier) => {
      const newTier = newTiers.find((d) => d.id === tier.fields.id)
      if (newTier) {
        newTiers = newTiers.filter((d) => d !== newTier)
        return tier.updateFields({
          name: newTier.name,
        })
      }
      return tier.destroy()
    })
  )

  if (newTiers?.length) {
    await new Promise((resolve, reject) =>
      tiersTable.create(
        newTiers.map((d) => ({ fields: { id: d.id, name: d.name } })),
        function (err) {
          if (err) {
            return reject(err)
          }
          resolve()
        }
      )
    )
  }
}
