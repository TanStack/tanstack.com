import { ossStats } from './stats'
import { httpRouter } from 'convex/server'
import { authComponent, createAuth } from './auth'

const http = httpRouter()

ossStats.registerRoutes(http)
authComponent.registerRoutes(http, createAuth)

export default http
