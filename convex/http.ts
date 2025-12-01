import { ossStats } from './stats'
import { httpRouter } from 'convex/server'
import { authComponent } from './auth'
import { createAuth } from './auth'
import { handleGitHubWebhook } from './feed/http'

const http = httpRouter()

ossStats.registerRoutes(http)
authComponent.registerRoutes(http, createAuth)

// GitHub webhook for feed releases
http.route({
  path: '/github/releases',
  method: 'POST',
  handler: handleGitHubWebhook,
})

export default http
