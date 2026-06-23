/// <reference types="node" />

import assert from 'node:assert/strict'
import { request } from 'node:https'
import { Buffer } from 'node:buffer'

const proofUrl =
  process.env.FORGE_PROOF_URL ??
  'https://tanstack-com-forge.thetanstack.workers.dev/api/forge/proof'
const proofToken = process.env.FORGE_PROOF_TOKEN
const provider = process.env.FORGE_PROOF_PROVIDER
const apiKey = process.env.FORGE_PROOF_PROVIDER_API_KEY
const model = process.env.FORGE_PROOF_MODEL
const sessionId =
  process.env.FORGE_PROOF_SESSION_ID ?? 'branch-proof-hosting-company'
const proofHttpTimeoutMs = readPositiveIntegerEnv(
  'FORGE_PROOF_HTTP_TIMEOUT_MS',
  20 * 60_000,
)
const proofMaxAttempts = readPositiveIntegerEnv('FORGE_PROOF_MAX_ATTEMPTS', 3)

assert.ok(proofToken, 'FORGE_PROOF_TOKEN is required')
assert.ok(
  !provider || provider === 'openai' || provider === 'anthropic',
  'FORGE_PROOF_PROVIDER must be openai or anthropic when provided',
)
assert.ok(
  !apiKey || provider === 'openai' || provider === 'anthropic',
  'FORGE_PROOF_PROVIDER is required when FORGE_PROOF_PROVIDER_API_KEY is set',
)

const turns = [
  {
    clientRequestId: `${sessionId}-turn-1`,
    prompt: [
      'Build a production-polished marketing site for a cloud hosting company called Northstar Cloud.',
      'It should have a sharp homepage with a specific hero, reliability proof, managed migration offer, pricing cards, infrastructure features, and a clear CTA.',
      'Use the existing TanStack Start scaffold and keep the files deployable.',
    ].join(' '),
    reset: true,
  },
  {
    clientRequestId: `${sessionId}-turn-2`,
    prompt: [
      'Iterate on the site.',
      'Make it feel more premium and specific to hosting infrastructure, add a practical comparison section, refine the pricing copy, and tighten the mobile layout.',
    ].join(' '),
    reset: false,
  },
]

let latest: ProofResponse | undefined

for (const turn of turns) {
  latest = await runProofTurnWithRetry(turn)
  assert.equal(latest.latestRun?.status, 'finished')
  assert.ok(latest.manifestVersionId, 'missing manifestVersionId')
  assert.ok(latest.fileCount > 0, 'expected generated files')
}

if (!latest) {
  throw new Error('missing proof response')
}

const finalResponse = latest

const assistantMessages = finalResponse.messages
  .filter((message) => message.role === 'assistant' && message.content)
  .map((message) => message.content?.trim() ?? '')
  .filter(Boolean)

assert.ok(assistantMessages.length > 0, 'expected assistant output')
assert.ok(
  Boolean(finalResponse.files['src/routes/index.tsx']),
  'expected generated home route',
)

const generatedSource = Object.values(finalResponse.files).join('\n')
const requiredContent = [
  'Northstar Cloud',
  'migration',
  'pricing',
  'comparison',
  'infrastructure',
] as const

for (const phrase of requiredContent) {
  assert.ok(
    generatedSource.toLowerCase().includes(phrase.toLowerCase()),
    `expected generated source to include ${phrase}`,
  )
}

console.log(
  JSON.stringify(
    {
      agentEventCount: finalResponse.agentEventCount,
      fileCount: finalResponse.fileCount,
      filePreviewPaths: Object.keys(finalResponse.files),
      latestRun: finalResponse.latestRun,
      manifestVersionId: finalResponse.manifestVersionId,
      messagePreview: assistantMessages.at(-1)?.slice(0, 500),
      runtimeSessionId: finalResponse.runtimeSessionId,
      topFiles: finalResponse.topFiles,
      workflowEventCount: finalResponse.workflowEventCount,
    },
    null,
    2,
  ),
)

async function runProofTurnWithRetry(
  turn: (typeof turns)[number],
): Promise<ProofResponse> {
  let lastError: unknown

  for (let attempt = 1; attempt <= proofMaxAttempts; attempt++) {
    try {
      return await runProofTurn({
        ...turn,
        clientRequestId:
          attempt === 1
            ? turn.clientRequestId
            : `${turn.clientRequestId}-retry-${attempt}`,
      })
    } catch (error) {
      lastError = error

      if (attempt >= proofMaxAttempts || !isRetryableProofError(error)) {
        throw error
      }

      const delayMs = attempt * 15_000
      console.warn(
        `Forge proof turn ${turn.clientRequestId} failed with a retryable error; retrying in ${delayMs}ms.`,
      )
      await sleep(delayMs)
    }
  }

  throw lastError
}

async function runProofTurn({
  clientRequestId,
  prompt,
  reset,
}: {
  clientRequestId: string
  prompt: string
  reset: boolean
}) {
  const response = await postJson(proofUrl, {
    body: {
      ...(apiKey ? { apiKey } : {}),
      clientRequestId,
      model,
      prompt,
      ...(provider ? { provider } : {}),
      reset,
      sessionId,
    },
    headers: {
      Authorization: `Bearer ${proofToken}`,
    },
  })
  const text = response.body

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Forge proof turn failed with ${response.status}: ${text.slice(0, 1200)}`,
    )
  }

  return JSON.parse(text) as ProofResponse
}

function isRetryableProofError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('Capacity temporarily exceeded') ||
    message.includes('fetch failed') ||
    message.includes('Headers Timeout Error') ||
    message.includes('timed out')
  )
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function postJson(
  url: string,
  {
    body,
    headers,
  }: {
    body: Record<string, unknown>
    headers: Record<string, string>
  },
) {
  const text = JSON.stringify(body)
  const contentLength = Buffer.byteLength(text)

  return new Promise<{ body: string; status: number }>((resolve, reject) => {
    const req = request(
      url,
      {
        headers: {
          ...headers,
          'Content-Length': String(contentLength),
          'Content-Type': 'application/json',
        },
        method: 'POST',
        timeout: proofHttpTimeoutMs,
      },
      (res) => {
        const chunks = Array<Buffer>()

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            status: res.statusCode ?? 0,
          })
        })
      },
    )

    req.on('error', reject)
    req.setTimeout(proofHttpTimeoutMs, () => {
      req.destroy(
        new Error(
          `Forge proof request timed out after ${proofHttpTimeoutMs}ms`,
        ),
      )
    })
    req.end(text)
  })
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

type ProofResponse = {
  activeChatId: string
  agentEventCount: number
  fileCount: number
  files: Record<string, string>
  latestRun?: {
    createdAt?: string
    endedAt?: string
    error?: string
    id: string
    startedAt?: string
    status: string
  }
  manifestVersionId?: string
  messages: Array<{
    content?: string
    role: string
    status: string
  }>
  runtimeSessionId: string
  topFiles: Array<string>
  workflowEventCount: number
}
