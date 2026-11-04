import type { KodyEnvironment } from './kody'
import { answerResultSchema, formatAnswer } from '../core/answers'
import { kodyCall } from './kody'
export async function runKodyAnswer(
  env: KodyEnvironment,
  userId: string,
  packageName: string,
  question: string,
  signal: AbortSignal,
  runId: string,
) {
  if (!/^@[a-zA-Z0-9_-]+\/answer-question$/.test(packageName))
    throw new Error('The Kody answer package name is invalid.')
  if (signal.aborted) throw new Error('Stopped')
  const response = await kodyCall(
    env,
    userId,
    'execute',
    {
      code: `import answer from ${JSON.stringify(`kody:${packageName}`)}\nexport default async function main(params) { return await answer(params) }`,
      params: {
        question,
        constraints: { allowChatModels: false, maxSearches: 2 },
      },
      idempotencyKey: `gum-answer-${runId}`,
      responseLimit: 16000,
    },
    signal,
  )
  if (signal.aborted) throw new Error('Stopped')
  if (response.isError)
    throw new Error(
      'Kody could not run your answer-question package. Check that it is published and configured in your Kody account. No chat model was called.',
    )
  const envelope = response.structuredContent as
    | { result?: unknown; isError?: boolean; error?: string }
    | undefined
  if (!envelope || envelope.error || envelope.isError)
    throw new Error(
      'Kody did not return a valid answer. No chat model fallback was used.',
    )
  const result = answerResultSchema.parse(envelope.result)
  if (result.usage.chatModelCalls !== 0)
    throw new Error(
      'The answer package reported a chat model call despite its restriction. The result was rejected.',
    )
  return { ...result, markdown: formatAnswer(result) }
}
