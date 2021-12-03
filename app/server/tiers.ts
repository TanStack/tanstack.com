import { getTiersTable } from './airtable'
import { graphqlWithAuth } from './github'

async function getTiersMeta() {
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

  return tiers
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
      }
    )
  })
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
                    monthlyPriceInDollars
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
    })
  )

  if (githubTiers?.length) {
    await createTiersMeta(githubTiers.map((d) => ({ id: d.id, name: d.name })))
  }
}
