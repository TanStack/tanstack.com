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

export async function exchangeGithubCodeForToken({
  code,
  state,
  redirectUrl,
}: {
  code: string
  state: string
  redirectUrl: string
}) {
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

export async function getTeamBySlug(slug: string) {
  const teams = await octokit.teams.list({
    org: GITHUB_ORG,
  })

  const sponsorsTeam = teams.data.find((x) => x.slug === slug)

  if (!sponsorsTeam) {
    throw new Error(`Cannot find team "${slug}" in the organization`)
  }

  return sponsorsTeam
}

// GitHub contributor stats - commented out due to performance/accuracy concerns
/*
export interface ContributorStats {
  username: string
  totalCommits: number
  totalPullRequests: number
  totalIssues: number
  totalReviews: number
  firstContribution: string | null
  lastContribution: string | null
  repositories: Array<{
    name: string
    commits: number
    pullRequests: number
    issues: number
    reviews: number
  }>
}

export async function getContributorStats(
  username: string
): Promise<ContributorStats> {
  try {
    // Use GraphQL for TanStack organization stats
    const query = `
      query($username: String!, $org: String!) {
        user(login: $username) {
          contributionsCollection(organizationID: $org) {
            totalCommitContributions
            totalPullRequestReviewContributions
            totalIssueContributions
            totalPullRequestContributions
            contributionCalendar {
              totalContributions
            }
          }
        }
        organization(login: $org) {
          id
        }
      }
    `

    const result = (await graphqlWithAuth(query, {
      username,
      org: GITHUB_ORG,
    })) as any

    const user = result.user

    return {
      username,
      totalCommits:
        user?.contributionsCollection?.totalCommitContributions || 0,
      totalPullRequests:
        user?.contributionsCollection?.totalPullRequestContributions || 0,
      totalIssues: user?.contributionsCollection?.totalIssueContributions || 0,
      totalReviews:
        user?.contributionsCollection?.totalPullRequestReviewContributions || 0,
      firstContribution: null, // GraphQL doesn't provide this easily
      lastContribution: null, // GraphQL doesn't provide this easily
      repositories: [], // Not tracking per-repo anymore
    }
  } catch (error) {
    console.error(`Error fetching stats for ${username}:`, error)
    return {
      username,
      totalCommits: 0,
      totalPullRequests: 0,
      totalIssues: 0,
      totalReviews: 0,
      firstContribution: null,
      lastContribution: null,
      repositories: [],
    }
  }
}

async function getContributorStatsForRepo(username: string, repoName: string) {
  const stats = {
    commits: 0,
    pullRequests: 0,
    issues: 0,
    reviews: 0,
    dates: [] as string[],
  }

  try {
    // Get commits by the user
    const commits = await octokit.repos.listCommits({
      owner: GITHUB_ORG,
      repo: repoName,
      author: username,
      per_page: 100,
    })

    stats.commits = commits.data.length
    stats.dates.push(
      ...commits.data
        .map((commit) => commit.commit.author?.date || '')
        .filter(Boolean)
    )

    // Get pull requests by the user
    const pullRequests = await octokit.pulls.list({
      owner: GITHUB_ORG,
      repo: repoName,
      state: 'all',
      per_page: 100,
    })

    const userPRs = pullRequests.data.filter(
      (pr) => pr.user?.login === username
    )
    stats.pullRequests = userPRs.length
    stats.dates.push(...userPRs.map((pr) => pr.created_at).filter(Boolean))

    // Get issues by the user
    const issues = await octokit.issues.listForRepo({
      owner: GITHUB_ORG,
      repo: repoName,
      state: 'all',
      per_page: 100,
    })

    const userIssues = issues.data.filter(
      (issue) => issue.user?.login === username
    )
    stats.issues = userIssues.length
    stats.dates.push(
      ...userIssues.map((issue) => issue.created_at).filter(Boolean)
    )

    // Get reviews by the user
    const reviews = await octokit.pulls.listReviews({
      owner: GITHUB_ORG,
      repo: repoName,
      pull_number: 1, // We'll need to iterate through all PRs for reviews
    })

    // Note: This is a simplified approach. For accurate review counts,
    // we'd need to iterate through all PRs and get reviews for each
    const userReviews = reviews.data.filter(
      (review) => review.user?.login === username
    )
    stats.reviews = userReviews.length
    stats.dates.push(
      ...userReviews.map((review) => review.submitted_at).filter(Boolean)
    )
  } catch (error) {
    console.error(`Error fetching stats for ${username} in ${repoName}:`, error)
  }

  return stats
}

export async function getContributorStatsForLibrary(
  username: string,
  libraryRepo: string
): Promise<ContributorStats> {
  try {
    const repoStats = await getContributorStatsForRepo(username, libraryRepo)

    return {
      username,
      totalCommits: repoStats.commits,
      totalPullRequests: repoStats.pullRequests,
      totalIssues: repoStats.issues,
      totalReviews: repoStats.reviews,
      firstContribution:
        repoStats.dates.length > 0 ? repoStats.dates.sort()[0] : null,
      lastContribution:
        repoStats.dates.length > 0 ? repoStats.dates.sort().reverse()[0] : null,
      repositories: [
        {
          name: libraryRepo,
          commits: repoStats.commits,
          pullRequests: repoStats.pullRequests,
          issues: repoStats.issues,
          reviews: repoStats.reviews,
        },
      ],
    }
  } catch (error) {
    console.error(
      `Error fetching library stats for ${username} in ${libraryRepo}:`,
      error
    )
    return {
      username,
      totalCommits: 0,
      totalPullRequests: 0,
      totalIssues: 0,
      totalReviews: 0,
      firstContribution: null,
      lastContribution: null,
      repositories: [],
    }
  }
}

// GraphQL approach for more efficient data fetching
export async function getContributorStatsGraphQL(
  username: string
): Promise<ContributorStats> {
  try {
    const query = `
      query($username: String!, $org: String!) {
        user(login: $username) {
          contributionsCollection {
            totalCommitContributions
            totalPullRequestReviewContributions
            totalIssueContributions
            totalPullRequestContributions
            contributionCalendar {
              totalContributions
            }
          }
        }
        organization(login: $org) {
          repositories(first: 100, privacy: PUBLIC) {
            nodes {
              name
              defaultBranchRef {
                target {
                  ... on Commit {
                    history(author: { login: $username }) {
                      totalCount
                    }
                  }
                }
              }
              pullRequests(first: 100, states: [OPEN, MERGED, CLOSED]) {
                nodes {
                  author {
                    login
                  }
                  createdAt
                }
              }
              issues(first: 100, states: [OPEN, CLOSED]) {
                nodes {
                  author {
                    login
                  }
                  createdAt
                }
              }
            }
          }
        }
      }
    `

    const result = await graphqlWithAuth(query, {
      username,
      org: GITHUB_ORG,
    })

    const user = result.user
    const org = result.organization

    const stats: ContributorStats = {
      username,
      totalCommits:
        user?.contributionsCollection?.totalCommitContributions || 0,
      totalPullRequests:
        user?.contributionsCollection?.totalPullRequestContributions || 0,
      totalIssues: user?.contributionsCollection?.totalIssueContributions || 0,
      totalReviews:
        user?.contributionsCollection?.totalPullRequestReviewContributions || 0,
      firstContribution: null,
      lastContribution: null,
      repositories: [],
    }

    // Process repository-specific data
    if (org?.repositories?.nodes) {
      for (const repo of org.repositories.nodes) {
        const commits = repo.defaultBranchRef?.target?.history?.totalCount || 0
        const pullRequests =
          repo.pullRequests?.nodes?.filter(
            (pr) => pr.author?.login === username
          ).length || 0
        const issues =
          repo.issues?.nodes?.filter(
            (issue) => issue.author?.login === username
          ).length || 0

        if (commits > 0 || pullRequests > 0 || issues > 0) {
          stats.repositories.push({
            name: repo.name,
            commits,
            pullRequests,
            issues,
            reviews: 0, // Would need additional query for reviews
          })
        }
      }
    }

    return stats
  } catch (error) {
    console.error(`Error fetching GraphQL stats for ${username}:`, error)
    return {
      username,
      totalCommits: 0,
      totalPullRequests: 0,
      totalIssues: 0,
      totalReviews: 0,
      firstContribution: null,
      lastContribution: null,
      repositories: [],
    }
  }
}

// Batch fetch stats for multiple contributors
export async function getBatchContributorStats(
  usernames: string[]
): Promise<ContributorStats[]> {
  const stats = await Promise.all(
    usernames.map((username) => getContributorStats(username))
  )
  return stats
}
*/
