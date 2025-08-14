import { defineApp } from 'convex/server'
import ossStats from '@erquhart/convex-oss-stats/convex.config'
import betterAuth from '@convex-dev/better-auth/convex.config'

const app = defineApp()
app.use(betterAuth)
app.use(ossStats)

export default app
