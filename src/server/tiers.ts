import { getTiersTable } from '~/server/airtable'
import { graphqlWithAuth } from '~/server/github'

async function getTiersMeta() {
  try {
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
        },
      )
    })

    return tiers
  } catch (err: any) {
    if (err.message === 'An API key is required to connect to Airtable') {
      console.error('Missing airtable credentials, returning mock data.')
      return []
    }
    throw err
  }
}

async function createTiersMeta(tiersMeta) {
  const tiersTable = await getTiersTable()

  return new Promise((resolve, reject) => {
    tiersTable.create(
      tiersMeta.map((d) => ({ fields: d })),
      function (err) {
        if (err) {
          return reject(err)
        }
        resolve()
      },
    )
  })
  // return Promise.resolve()
}

export async function getTierById(tierId) {
  const tiers = await getGithubTiers()
  const tier = tiers.find((d) => d.id == tierId)

  if (!tier) {
    throw new Error(`Could not find tier with id: ${tierId}`)
  }

  const tiersMeta = await getTiersMeta()
  const tierMeta = tiersMeta.find((d) => d.fields.id === tierId)

  if (!tierMeta) {
    throw new Error(`Could not find tierMeta with id: ${tierId}`)
  }

  return {
    ...tier,
    meta: tierMeta,
  }
}

export async function getGithubTiers() {
  try {
    const res: any = await graphqlWithAuth(
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
                      monthlyPriceInDollars
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    )

    return res.viewer.sponsorshipsAsMaintainer.nodes[0].sponsorable
      .sponsorsListing.tiers.nodes
  } catch (err: any) {
    if (err?.status === 401) {
      console.error('Missing github credentials, returning mock data.')
      return []
    }

    throw err
  }
}

export async function getGithubTiersWithMeta() {
  const githubTiers = await getGithubTiers()
  const tiersMeta = await getTiersMeta()

  return githubTiers.map((d) => ({
    ...d,
    meta: tiersMeta.find((meta) => meta.fields?.id == d.id)?.fields,
  }))
}

export async function updateTiersMeta(githubTiers) {
  const tiersMeta = await getTiersMeta()

  await Promise.all(
    tiersMeta.map((tierMeta) => {
      const newTier = githubTiers.find((d) => d.id === tierMeta.fields.id)
      if (newTier) {
        githubTiers = githubTiers.filter((d) => d !== newTier)
        return tierMeta.updateFields({
          name: newTier.name,
        })
      }
      return tierMeta.destroy()
    }),
  )

  if (githubTiers?.length) {
    await createTiersMeta(githubTiers.map((d) => ({ id: d.id, name: d.name })))
  }
}
