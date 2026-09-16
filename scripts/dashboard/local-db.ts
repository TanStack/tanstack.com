import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const db = new PGlite('.dashboard-db')
await db.waitReady
const server = new PGLiteSocketServer({
  db,
  host: '127.0.0.1',
  port: 5441,
  maxConnections: 20,
})
await server.start()
console.log('Dashboard database listening on 127.0.0.1:5441')
const close = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', () => void close())
process.on('SIGTERM', () => void close())
