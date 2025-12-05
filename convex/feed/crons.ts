import { cronJobs } from 'convex/server'
import { api } from '../_generated/api'

const crons = cronJobs()

// Sync GitHub releases hourly as fallback for missed webhooks
crons.hourly(
  'syncGitHubReleases',
  {
    minuteUTC: 0,
  },
  api.feed.github.syncGitHubReleases,
  {},
)

// Note: Blog sync requires server-side access to content-collections
// This should be triggered via a server endpoint or manual admin action
// The cron is kept here for future implementation when server-side cron triggers are available

export default crons
