import http from 'node:http'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import url from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const clientDir = path.join(rootDir, 'dist/client')
const serverModuleUrl = url.pathToFileURL(
  path.join(rootDir, 'dist/server/server.js'),
).href

const mod = await import(serverModuleUrl)
const app = mod.default || mod.app || mod
const port = Number(process.env.PORT || 3000)

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
}

function tryServeStatic(req, res, pathname) {
  // Resolve safely under clientDir
  const decoded = decodeURIComponent(pathname)
  const filePath = path.join(clientDir, decoded)
  if (!filePath.startsWith(clientDir + path.sep) && filePath !== clientDir) {
    return false
  }
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch {
    return false
  }
  if (!stat.isFile()) return false
  const ext = path.extname(filePath).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.setHeader('Content-Length', stat.size)
  if (ext === '.js' || ext === '.css' || ext === '.woff2' || ext === '.woff') {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  fs.createReadStream(filePath).pipe(res)
  return true
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)

    // Serve static client assets directly (Netlify CDN handles this in prod).
    if (
      req.method === 'GET' &&
      requestUrl.pathname !== '/' &&
      tryServeStatic(req, res, requestUrl.pathname)
    ) {
      return
    }

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
