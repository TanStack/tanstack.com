import { graphql } from '@octokit/graphql'
import { env } from '~/utils/env'

export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${env.GITHUB_AUTH_TOKEN}`,
  },
})
