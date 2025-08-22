import { ossStats } from './stats'
import { httpRouter } from 'convex/server'
import { betterAuthComponent } from './auth'
import { createAuth } from '../src/server/auth'

const http = httpRouter()

ossStats.registerRoutes(http)
betterAuthComponent.registerRoutes(http, createAuth)

export default http
