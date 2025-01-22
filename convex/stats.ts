import { OssStats } from '@erquhart/convex-oss-stats'
import { components } from './_generated/api'

export const ossStats = new OssStats(components.ossStats, {
  githubOwners: ['tanstack'],
  npmOrgs: ['tanstack', 'tannerlinsley'],
})

export const { getGithubOwner, getNpmOrg, sync, clearAndSync } = ossStats.api()
