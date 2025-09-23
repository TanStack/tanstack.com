import { OssStats } from '@erquhart/convex-oss-stats'
import { components } from './_generated/api'
import { query } from './_generated/server'
import { v } from 'convex/values'

export const ossStats = new OssStats(components.ossStats, {
  githubOwners: ['tanstack'],
  npmOrgs: ['tanstack', 'tannerlinsley'],
})

export const getStats = query({
  args: {
    library: v.optional(
      v.object({
        id: v.string(),
        repo: v.string(),
        frameworks: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const githubData = args.library
      ? await ossStats.getGithubRepo(ctx, args.library.repo)
      : await ossStats.getGithubOwner(ctx, 'tanstack')
    const npmData = args.library
      ? await ossStats.getNpmPackages(
          ctx,
          args.library.frameworks.map(
            (framework) => `@tanstack/${framework}-${args.library?.id}`
          )
        )
      : await ossStats.getNpmOrg(ctx, 'tanstack')
    return {
      github: githubData,
      npm: npmData,
    }
  },
})

export const {
  getGithubOwner,
  getNpmOrg,
  getGithubRepo,
  getGithubRepos,
  getNpmPackages,
  sync,
  clearAndSync,
} = ossStats.api()
