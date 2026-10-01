import type { KodyEnvironment } from './kody'
import type { UsageLedger, UsageContext } from './usage'
import { choice, decide } from '@tanstack/ai'
import { createTypesafeDecider } from '@tanstack/ai-typesafe'
import { z } from 'zod'
import {
  evidenceSchema,
  runResearchLoop,
  type ResearchContext,
  type ResearchEvent,
  type ResearchPlugin,
  type SourceAction,
} from '../core/research-loop'
import { kodyCall } from './kody'
const usage = z.object({
  sourceCalls: z.literal(1),
  jevCalls: z.literal(0),
  chatModelCalls: z.literal(0),
})
const searchResult = z.object({
  version: z.literal(1),
  articles: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(1000),
      }),
    )
    .max(5),
  usage,
})
const readResult = z.object({
  version: z.literal(1),
  evidence: z.array(evidenceSchema).max(100),
  usage,
})
export async function runSource(
  env: KodyEnvironment & { TYPESAFE_API_KEY: string },
  userId: string,
  packageName: string,
  action: SourceAction,
  signal: AbortSignal,
  key: string,
) {
  if (!/^@[a-zA-Z0-9_-]+\/answer-question$/.test(packageName))
    throw new Error('Invalid source package name.')
  const operation =
    action.tool === 'wikipedia_search'
      ? 'wikipedia-search'
      : action.tool === 'wikipedia_read'
        ? 'wikipedia-read'
        : undefined
  if (!operation) throw new Error('Unknown source tool.')
  if (signal.aborted) throw new Error('Stopped')
  const response = await kodyCall(
    env,
    userId,
    'execute',
    {
      code: `import lookup from ${JSON.stringify(`kody:${packageName}/${operation}`)}\nexport default async function main(params) { return await lookup(params) }`,
      params: action.input,
      idempotencyKey: key,
      responseLimit: 220000,
    },
    signal,
  )
  if (signal.aborted) throw new Error('Stopped')
  const envelope = response.structuredContent as
    | {
        result?: unknown
        isError?: boolean
        error?: string
        truncated?: boolean
      }
    | undefined
  if (
    response.isError ||
    !envelope ||
    envelope.error ||
    envelope.isError ||
    envelope.truncated
  )
    throw new Error(
      'Kody could not read the source. Check that your source package is published. No chat model fallback was used.',
    )
  const parsed = (
    action.tool === 'wikipedia_search' ? searchResult : readResult
  ).safeParse(envelope.result)
  if (!parsed.success)
    throw new Error(
      'Kody returned an invalid source result. No chat model fallback was used.',
    )
  return parsed.data
}
export async function research(
  context: ResearchContext,
  env: KodyEnvironment & { TYPESAFE_API_KEY: string },
  userId: string,
  packageName: string,
  runId: string,
  signal: AbortSignal,
  event: (event: ResearchEvent) => Promise<void>,
  tool: (
    action: SourceAction,
    execute: () => Promise<unknown>,
  ) => Promise<void>,
  accounting?: { ledger: UsageLedger; context: UsageContext },
) {
  if (!env.TYPESAFE_API_KEY)
    throw new Error('Configure Jev before researching.')
  let sourceCall = 0
  const plugin: ResearchPlugin = {
    id: 'wikipedia',
    candidates(state) {
      return [
        ...state.queries.map((query, i) => ({
          id: `wiki-search-${i}`,
          tool: 'wikipedia_search',
          description:
            'Search Wikipedia for stable encyclopedic facts. Returns article titles, not answers.',
          input: { query },
          effect: { search: query },
        })),
        ...state.articles.map((article, i) => ({
          id: `wiki-read-${i}`,
          tool: 'wikipedia_read',
          description:
            'Read a discovered Wikipedia article for exact supporting passages.',
          input: { title: article.title },
          effect: { read: article.title },
        })),
      ]
    },
    async execute(action, abortSignal) {
      let result: Awaited<ReturnType<typeof runSource>> | undefined
      await tool(action, async () => {
        result = await runSource(
          env,
          userId,
          packageName,
          action,
          abortSignal,
          `gum-source-${runId}-${++sourceCall}`,
        )
        return result
      })
      if (!result) throw new Error('Source execution did not return a result.')
      return result
    },
  }
  return runResearchLoop(
    context,
    {
      plugins: [plugin],
      event,
      async evaluate(state, questions, abortSignal) {
        try {
          const run = () =>
            decide({
              adapter: createTypesafeDecider(
                'jev-latest',
                env.TYPESAFE_API_KEY!,
              ),
              state,
              questions: Object.fromEntries(
                Object.entries(questions).map(([key, question]) => [
                  key,
                  choice(question),
                ]),
              ),
              abortSignal,
            })
          const result = accounting
            ? await accounting.ledger.measure(
                accounting.context,
                {
                  kind: 'jev',
                  provider: 'typesafe',
                  model: 'jev-latest',
                  operation: 'Research decision',
                },
                run,
                (result) => result.meta.usage,
                abortSignal,
              )
            : await run()
          return {
            answers: result,
            inputTokens: result.meta.usage?.promptTokens ?? 0,
            outputTokens: result.meta.usage?.completionTokens ?? 0,
          }
        } catch {
          throw new Error(
            'Jev could not choose the next step. No chat model fallback was used.',
          )
        }
      },
    },
    signal,
  )
}
