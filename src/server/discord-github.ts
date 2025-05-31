import { Octokit } from '@octokit/rest'
import { linkSponsorToken } from '~/server/discord'
import { getSponsorsAndTiers } from '~/server/sponsors'

export async function linkGithubAndDiscordUser({ githubToken, discordToken }) {
  let login

  try {
    const octokit = new Octokit({
      auth: githubToken,
      useAgent: `TanStack.com ${githubToken}`,
    })

    const { data } = await octokit.users.getAuthenticated()

    login = data.login
  } catch (err) {
    console.error(err)
    throw new Error('Unable to fetch GitHub user info. Please log in again.')
  }

  let sponsor
  try {
    const { sponsors } = await getSponsorsAndTiers()

    sponsor = sponsors.find((d) => d.login == login)
  } catch (err) {
    throw new Error('Unable to fetch sponsor info. Please contact support.')
  }

  if (!sponsor) {
    throw new Error(
      `TanStack sponsorship not found for GitHub user "${login}". Please sign up at https://github.com/sponsors/tannerlinsley`,
    )
  }

  const sponsorType = sponsor.tier.meta.sponsorType

  const message = await linkSponsorToken({
    discordToken,
    sponsorType,
  })

  return message
}
