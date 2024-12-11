import { OssStats } from '@erquhart/convex-oss-stats'
import { components } from './_generated/api'

const ossStats = new OssStats(components.ossStats, {
  githubOwners: ['tanstack'],
  npmOrgs: ['tanstack'],
})

export const { getGithubOwner, getNpmOrg, sync } = ossStats.api()
