import { OssStats } from '@convex-dev/oss-stats'
import { components } from './_generated/api'
import { v } from 'convex/values'
import { action, query } from './_generated/server'

const ossStats = new OssStats(components.ossStats, {
  githubOwners: ['tanstack'],
  npmOrgs: ['tanstack'],
})

// export const { getGithubOwner, getNpmOrg, sync } = ossStats.api()

export const getGithubOwner = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return ossStats.getGithubOwner(ctx, args.owner)
  },
})

export const getNpmOrg = query({
  args: { org: v.string() },
  handler: async (ctx, args) => {
    return ossStats.getNpmOrg(ctx, args.org)
  },
})

export const sync = action({
  handler: async (ctx) => {
    return ossStats.sync(ctx)
  },
})
