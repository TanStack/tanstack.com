import http from 'node:http'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const serverModuleUrl = url.pathToFileURL(
  path.join(rootDir, 'dist/server/server.js'),
).href

const mod = await import(serverModuleUrl)
const app = mod.default || mod.app || mod
const port = Number(process.env.PORT || 3000)

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
    const chunks = []

    for await (const chunk of req) {
      chunks.push(chunk)
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers: req.headers,
      body:
        req.method === 'GET' || req.method === 'HEAD'
          ? undefined
          : Buffer.concat(chunks),
    })
    const response = await app.fetch(request)

    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    if (!response.body || req.method === 'HEAD') {
      res.end()
      return
    }

    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error(error)
    res.statusCode = 500
    res.end(String(error?.stack || error))
  }
})

server.listen(port, () => {
  console.log(`Production server listening on http://localhost:${port}`)
})
