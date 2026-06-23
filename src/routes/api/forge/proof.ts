import { createFileRoute } from '@tanstack/react-router'
import { hasForgeCloudRuntimeStorage } from '~/builder/runtime/forge-cloud-store.server'
import { hasForgeSessionDurableObjects } from '~/builder/runtime/forge-session-runtime.server'
import type { ForgeProviderCredential } from '~/builder/runtime/forge-byok.server'
import {
  initializeLocalForgeRuntimeSession,
  withLocalForgeRuntimeSession,
} from '~/builder/runtime/local-store.server'
import { runLocalForgeAgent } from '~/builder/runtime/local-agent.server'

const DEFAULT_PROOF_SESSION_ID = 'branch-proof-hosting-company'
const MAX_PROOF_PROMPT_LENGTH = 4000

export const Route = createFileRoute('/api/forge/proof')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const accessError = await validateForgeProofAccess(request)

        if (accessError) {
          return accessError
        }

        const body = await readProofBody(request)

        if (!body.ok) {
          return Response.json({ error: body.error }, { status: 400 })
        }

        const runtimeSessionId =
          normalizeProofSessionId(body.value.sessionId) ??
          DEFAULT_PROOF_SESSION_ID
        const prompt = body.value.prompt.trim()
        const providerCredential = readProofProviderCredential(body.value)

        if (!providerCredential) {
          return Response.json(
            {
              error:
                'Proof runs require a provider and apiKey in the request body.',
            },
            { status: 400 },
          )
        }

        const cloudRuntimeError = await validateForgeCloudRuntime()

        if (cloudRuntimeError) {
          return cloudRuntimeError
        }

        const snapshot = await withLocalForgeRuntimeSession(
          runtimeSessionId,
          async () => {
            if (body.value.reset !== false) {
              await initializeLocalForgeRuntimeSession(runtimeSessionId)
            }

            return runLocalForgeAgent({
              clientRequestId:
                normalizeProofSessionId(body.value.clientRequestId) ??
                `proof-request-${crypto.randomUUID()}`,
              prompt,
              providerCredential,
            })
          },
        )

        return Response.json({
          activeChatId: snapshot.activeChatId,
          agentEventCount: snapshot.agentEvents.length,
          fileCount: snapshot.fileCount,
          latestRun: snapshot.latestRun,
          manifestVersionId: snapshot.manifestVersionId,
          messages: snapshot.messages.map((message) => ({
            content: message.content,
            role: message.role,
            status: message.status,
          })),
          runtimeSessionId,
          topFiles: snapshot.topFiles,
          workflowEventCount: snapshot.workflowEvents.length,
        })
      },
    },
  },
})

type ProofBody = {
  apiKey?: unknown
  clientRequestId?: unknown
  model?: unknown
  prompt?: unknown
  provider?: unknown
  reset?: unknown
  sessionId?: unknown
}

async function validateForgeProofAccess(request: Request) {
  if (process.env.FORGE_PROOF_ENABLED !== 'true') {
    return Response.json({ error: 'Forge proof is not enabled.' }, { status: 404 })
  }

  const expectedHost = process.env.FORGE_PROOF_HOST?.trim()
  const requestHost = new URL(request.url).host

  if (!expectedHost || requestHost !== expectedHost) {
    return Response.json({ error: 'Forge proof host mismatch.' }, { status: 404 })
  }

  const expectedToken = process.env.FORGE_PROOF_TOKEN?.trim()
  const providedToken = readProofToken(request)

  if (!expectedToken || expectedToken.length < 32 || providedToken !== expectedToken) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return undefined
}

async function validateForgeCloudRuntime() {
  const [hasStorage, hasSessions] = await Promise.all([
    hasForgeCloudRuntimeStorage(),
    hasForgeSessionDurableObjects(),
  ])

  if (!hasStorage || !hasSessions) {
    return Response.json(
      {
        error:
          'Forge proof requires the Cloudflare R2 runtime bucket and Session Durable Object bindings.',
      },
      { status: 409 },
    )
  }

  return undefined
}

async function readProofBody(request: Request) {
  let value: unknown

  try {
    value = await request.json()
  } catch {
    return { error: 'Expected a JSON body.', ok: false } as const
  }

  if (!isRecord(value)) {
    return { error: 'Expected a JSON object.', ok: false } as const
  }

  const body = value as ProofBody

  if (typeof body.prompt !== 'string') {
    return { error: 'prompt is required.', ok: false } as const
  }

  const prompt = body.prompt.trim()

  if (!prompt || prompt.length > MAX_PROOF_PROMPT_LENGTH) {
    return {
      error: `prompt must be between 1 and ${MAX_PROOF_PROMPT_LENGTH} characters.`,
      ok: false,
    } as const
  }

  return {
    ok: true,
    value: {
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      clientRequestId:
        typeof body.clientRequestId === 'string'
          ? body.clientRequestId
          : undefined,
      model: typeof body.model === 'string' ? body.model : undefined,
      prompt,
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      reset: typeof body.reset === 'boolean' ? body.reset : undefined,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    },
  } as const
}

function readProofProviderCredential(
  body: NonNullable<Awaited<ReturnType<typeof readProofBody>>['value']>,
): ForgeProviderCredential | undefined {
  const provider = body.provider?.trim()
  const apiKey = body.apiKey?.trim()
  const model = body.model?.trim()

  if (!apiKey) {
    return undefined
  }

  if (provider !== 'openai' && provider !== 'anthropic') {
    return undefined
  }

  return {
    apiKey,
    model: model || undefined,
    provider,
  }
}

function readProofToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-forge-proof-token')?.trim()
}

function normalizeProofSessionId(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 96)

  return normalized || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
