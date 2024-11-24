import { OssStats } from '@convex-dev/oss-stats'
import { query } from './_generated/server'
import { components } from './_generated/api'
import { v } from 'convex/values'

const ossStats = new OssStats(components.ossStats, {
  githubOwners: ['tanstack'],
})

export const { getGithubOwnerStars, sync } = ossStats.api()

/*
export const getGithubOwnerStars = query({
  args: { owner: v.string() },
  handler: async (ctx, args) => {
    return ossStats.getGithubOwnerStars(ctx, args.owner)
  },
})

export const testing = query({
  args: {},
  handler: async () => {
    return 'testing'
  },
})
*/
