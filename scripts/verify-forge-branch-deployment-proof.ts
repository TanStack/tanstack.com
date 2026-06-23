/// <reference types="node" />

import assert from 'node:assert/strict'

const proofUrl =
  process.env.FORGE_PROOF_URL ??
  'https://tanstack-com-forge.thetanstack.workers.dev/api/forge/proof'
const proofToken = process.env.FORGE_PROOF_TOKEN
const provider = process.env.FORGE_PROOF_PROVIDER
const apiKey = process.env.FORGE_PROOF_PROVIDER_API_KEY
const model = process.env.FORGE_PROOF_MODEL
const sessionId =
  process.env.FORGE_PROOF_SESSION_ID ?? 'branch-proof-hosting-company'

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
  latest = await runProofTurn(turn)
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
  finalResponse.topFiles.some((file) => file === 'src/routes/index.tsx'),
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

async function runProofTurn({
  clientRequestId,
  prompt,
  reset,
}: {
  clientRequestId: string
  prompt: string
  reset: boolean
}) {
  const response = await fetch(proofUrl, {
    body: JSON.stringify({
      ...(apiKey ? { apiKey } : {}),
      clientRequestId,
      model,
      prompt,
      ...(provider ? { provider } : {}),
      reset,
      sessionId,
    }),
    headers: {
      Authorization: `Bearer ${proofToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Forge proof turn failed with ${response.status}: ${text.slice(0, 1200)}`,
    )
  }

  return JSON.parse(text) as ProofResponse
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
