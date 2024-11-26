import { defineApp } from 'convex/server'
import ossStats from '@erquhart/convex-oss-stats/convex.config'

const app = defineApp()
app.use(ossStats)

export default app
