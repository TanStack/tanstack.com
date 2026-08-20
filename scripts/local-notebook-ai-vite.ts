import { spawn } from 'node:child_process'
import { once } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import readline from 'node:readline'
import type { PluginOption } from 'vite'
import { notebookAiLocalValidationEndpoint } from '../src/utils/notebook-ai-local-validation'

const maxRequestBytes = 2 * 1024 * 1024
const maxResponseBytes = 24 * 1024 * 1024

export function localNotebookAi(): PluginOption {
  let bridgeProcess: ReturnType<typeof spawn> | undefined
  let bridgeReady: Promise<number> | undefined

  return {
    name: 'tanstack-local-notebook-ai',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('close', () => bridgeProcess?.kill())

      server.middlewares.use(async (request, response, next) => {
        if (!request.url) return next()
        const url = new URL(request.url, 'http://localhost')
        if (
          url.pathname !== '/api/notebook/chatgpt' &&
          url.pathname !== '/api/notebook/chatgpt/assist' &&
          url.pathname !== notebookAiLocalValidationEndpoint
        ) {
          return next()
        }

        if (!isLocalRequest(request)) {
          sendJson(response, 403, { error: 'Local notebook AI access only' })
          return
        }
        if (request.method === 'POST' && !isJsonRequest(request)) {
          sendJson(response, 415, {
            error: 'Content-Type must be application/json',
          })
          return
        }

        try {
          const requestBody =
            request.method === 'POST'
              ? await readRequestBody(request, maxRequestBytes)
              : ''
          const bridgePath = getBridgePath(
            url.pathname,
            request.method,
            requestBody,
          )
          if (!bridgePath) {
            sendJson(response, 404, { error: 'Not found' })
            return
          }

          const port = await startBridge()
          const abortController = new AbortController()
          request.once('aborted', () => abortController.abort())
          response.once('close', () => {
            if (!response.writableEnded) abortController.abort()
          })
          const bridgeResponse = await fetch(
            `http://127.0.0.1:${port}${bridgePath}`,
            {
              method: request.method,
              headers: { 'Content-Type': 'application/json' },
              ...(request.method === 'POST' ? { body: requestBody } : {}),
              signal: abortController.signal,
            },
          )
          await pipeBridgeResponse(
            bridgeResponse,
            response,
            maxResponseBytes,
            abortController.signal,
          )
        } catch (error) {
          if (!response.writableEnded && !response.destroyed) {
            if (response.headersSent) {
              response.destroy()
            } else {
              const status = error instanceof ProxyError ? error.status : 502
              sendJson(response, status, { error: formatError(error) })
            }
          }
        }
      })

      function startBridge() {
        if (bridgeReady) return bridgeReady
        bridgeReady = new Promise<number>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              '--import',
              'tsx',
              path.join(
                server.config.root,
                'scripts/notebook-ai-app-server.ts',
              ),
            ],
            {
              cwd: server.config.root,
              env: {
                ...process.env,
                CODEX_HOME: path.join(
                  server.config.root,
                  '.cache/notebook-ai/codex-home',
                ),
                NOTEBOOK_AI_PORT: '0',
              },
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          )
          bridgeProcess = child
          child.stderr.resume()
          const timeout = setTimeout(() => {
            child.kill()
            reject(new Error('Notebook AI bridge timed out while starting'))
          }, 30_000)
          const lines = readline.createInterface({ input: child.stdout })
          lines.on('line', (line) => {
            try {
              const value: unknown = JSON.parse(line)
              if (
                isRecord(value) &&
                value.type === 'listening' &&
                typeof value.port === 'number'
              ) {
                clearTimeout(timeout)
                resolve(value.port)
              }
            } catch {
              // The bridge emits only its listening handshake on stdout.
            }
          })
          child.once('error', (error) => {
            clearTimeout(timeout)
            bridgeProcess = undefined
            bridgeReady = undefined
            reject(error)
          })
          child.once('exit', (code) => {
            clearTimeout(timeout)
            lines.close()
            bridgeProcess = undefined
            bridgeReady = undefined
            reject(
              new Error(`Notebook AI bridge exited (${code ?? 'unknown'})`),
            )
          })
        })
        return bridgeReady
      }
    },
  }
}

async function readRequestBody(request: IncomingMessage, limit: number) {
  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new ProxyError(413, 'Request body too large')
  }

  const chunks: Array<Buffer> = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > limit) throw new ProxyError(413, 'Request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function pipeBridgeResponse(
  source: Response,
  destination: ServerResponse,
  limit: number,
  signal: AbortSignal,
) {
  destination.statusCode = source.status
  destination.setHeader('Cache-Control', 'no-store')
  destination.setHeader(
    'Content-Type',
    source.headers.get('content-type') ?? 'application/octet-stream',
  )
  if (source.headers.get('x-accel-buffering') === 'no') {
    destination.setHeader('X-Accel-Buffering', 'no')
  }
  destination.flushHeaders()

  if (!source.body) {
    destination.end()
    return
  }

  const reader = source.body.getReader()
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new ProxyError(502, 'Notebook AI bridge response too large')
      }
      if (!destination.write(chunk.value)) {
        await once(destination, 'drain', { signal })
      }
    }
  } finally {
    reader.releaseLock()
  }
  if (!destination.writableEnded && !destination.destroyed) destination.end()
}

function getBridgePath(
  pathname: string,
  method: string | undefined,
  body: string,
) {
  if (pathname === '/api/notebook/chatgpt/assist' && method === 'POST') {
    return '/assist'
  }
  if (pathname === notebookAiLocalValidationEndpoint && method === 'POST') {
    return '/validation'
  }
  if (pathname !== '/api/notebook/chatgpt') return
  if (method === 'GET') return '/account'
  if (method !== 'POST') return

  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    throw new ProxyError(400, 'Invalid JSON request')
  }
  if (!isRecord(value)) throw new ProxyError(400, 'Invalid JSON request')
  if (value.action === 'login') return '/login'
  if (value.action === 'logout') return '/logout'
  if (value.action === 'cancelLogin') return '/login/cancel'
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.statusCode = status
  response.end(JSON.stringify(value))
}

function isLocalRequest(request: IncomingMessage) {
  const host = request.headers.host
  if (!host || !isLocalUrl(`http://${host}`)) return false
  const origin = request.headers.origin
  return !origin || isLocalUrl(origin)
}

function isJsonRequest(request: IncomingMessage) {
  return (
    request.headers['content-type']?.split(';', 1)[0]?.trim() ===
    'application/json'
  )
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

class ProxyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
