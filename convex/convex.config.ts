import { defineApp } from 'convex/server'
import ossStats from '@convex-dev/oss-stats/convex.config'

const app = defineApp()
app.use(ossStats)

export default app
