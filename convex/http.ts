import { ossStats } from './stats'
import { httpRouter } from 'convex/server'

const http = httpRouter()

ossStats.registerRoutes(http)

export default http
