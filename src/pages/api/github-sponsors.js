import { middleware } from '../../server/middleware'
import { getSponsorsAndTiers } from '../../server/sponsors'

export default async function handler(req, res) {
  await middleware(req, res)
  let { sponsors, tiers } = await getSponsorsAndTiers()
  sponsors = sponsors.filter((d) => d.privacyLevel === 'PUBLIC')

  res.status(200)
  res.setHeader('Cache-Control', `s-maxage=${60 * 5}, stale-while-revalidate`) // Cache for 5 minutes
  res.json({ sponsors, tiers })
}
