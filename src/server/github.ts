import axios from 'axios'
import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'

export const GITHUB_ORG = 'TanStack'

export const octokit = new Octokit({
  auth: process.env.GITHUB_AUTH_TOKEN,
  userAgent: 'TanStack.com',
})

export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_AUTH_TOKEN}`,
  },
})

const githubClientID = 'Iv1.3aa8d13a4a3fde91'
const githubClientSecret = 'e2340f390f956b6fbfb9c6f85100d6cfe07f29a8'

export async function exchangeGithubCodeForToken({ code, state, redirectUrl }) {
  try {
    const { data } = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: githubClientID,
        client_secret: githubClientSecret,
        code,
        redirect_uri: redirectUrl,
        state,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    return data.access_token
  } catch (err) {
    console.error(err)
    throw new Error('Unable to authenticate with GitHub. Please log in again.')
  }
}

export async function getTeamBySlug(slug) {
  const teams = await octokit.teams.list({
    org: GITHUB_ORG,
  })

  const sponsorsTeam = teams.data.find((x) => x.slug === slug)

  if (!sponsorsTeam) {
    throw new Error(`Cannot find team "${slug}" in the organization`)
  }

  return sponsorsTeam
}
