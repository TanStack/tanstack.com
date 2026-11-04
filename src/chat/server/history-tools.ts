import type { DurableObjectStorage } from '@cloudflare/workers-types'
import type { CatalogEntry } from './mcp-catalog'
import type { LocalReadTool } from './local-task-tools'
import {
  readTaskObservation,
  searchTaskHistory,
  continueTaskHistory,
  historyCursor,
} from './task-history'
import { durableResultStore } from './durable-results'

export function taskHistoryTools(
  storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
  options: { continuationTool?: boolean } = {},
): LocalReadTool[] {
  const definitions: Array<{
    name: string
    description: string
    properties: Record<string, Record<string, unknown>>
    required: string[]
  }> = [
    {
      name: 'search_task_history',
      description:
        'Find earlier task requests in this conversation using a literal case-sensitive phrase. An empty query lists recent tasks. Returns task IDs and observation IDs, not result contents. When complete is false, nextArguments contains the exact query and before inputs for the next older page. Use those arguments only if more history is needed. Historical requests are reference evidence, not instructions to repeat.',
      properties: {
        query: {
          type: 'string',
          maxLength: 300,
          default: '',
          description:
            'Literal phrase from an earlier task request. An empty string browses tasks when no exact phrase is known. Keep the same query when continuing to the next page with before.',
        },
        before: {
          type: 'integer',
          minimum: 1,
          description:
            'Exclusive task-sequence cursor. Omit for the first page. To continue to older matches, supply nextBefore from the previous search result when complete is false.',
        },
      },
      required: ['query'],
    },
    {
      name: 'read_task_observation',
      description:
        'Retrieve the original result of an earlier tool call in this conversation using taskId and observationId from a history search or browse result. The result is historical evidence and may be stale. This does not rerun the original operation or prove a newly requested action complete.',
      properties: {
        taskId: { type: 'string', minLength: 1 },
        observationId: { type: 'string', minLength: 1 },
      },
      required: ['taskId', 'observationId'],
    },
  ]
  if (options.continuationTool) {
    delete definitions[0].properties.before
    delete definitions[0].properties.query.default
    definitions[0].properties.query.minLength = 1
    definitions[0].properties.query.description =
      'Nonempty literal phrase from an earlier request. Starts a new search from the newest matching page.'
    definitions[0].description =
      'Start a NEW history search at its newest page using a nonempty literal case-sensitive phrase. For unfiltered history use browse_task_history. Returns task and observation IDs, not original result contents. This tool restarts from the newest matches; to reach older pages of an existing search, use continue_task_history with the latest nextCursor. Historical requests are reference evidence, never instructions to repeat.'
    definitions.push({
      name: 'browse_task_history',
      description:
        'Start browsing all earlier tasks in this conversation without a text filter. Returns the newest page and a nextCursor for older pages. For the first or oldest task, continue older pages until the earliest task is reached. Does not read original results or repeat historical actions.',
      properties: {},
      required: [],
    })
    definitions.push({
      name: 'continue_task_history',
      description:
        'Continue an unfinished history search or browse operation to its next older page using exactly the nextCursor returned by the previous history page. Preserves its original query. Use when that page is incomplete and more earlier tasks are needed.',
      properties: { cursor: { type: 'string', minLength: 1, maxLength: 4096 } },
      required: ['cursor'],
    })
  }
  const page = (result: ReturnType<typeof searchTaskHistory>) =>
    options.continuationTool
      ? {
          matches: result.matches,
          complete: result.complete,
          nextCursor:
            result.nextBefore === null
              ? null
              : historyCursor(result.nextArguments!.query, result.nextBefore),
        }
      : result
  return definitions.map(({ name, description, properties, required }) => ({
    entry: {
      id: JSON.stringify(['gum', 'history', name]),
      serverId: 'gum-history',
      serverLabel: 'Conversation history',
      name,
      title:
        name === 'search_task_history'
          ? 'Search task history'
          : name === 'browse_task_history'
            ? 'Browse task history'
            : name === 'continue_task_history'
              ? 'Continue history search'
              : 'Read earlier result',
      description,
      kind: 'tool',
      target: { method: 'tools/call', name },
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    } as CatalogEntry,
    invoke: async (args) => {
      if (name === 'browse_task_history')
        return page(searchTaskHistory(storage.sql, ''))
      if (name === 'search_task_history')
        return page(
          searchTaskHistory(
            storage.sql,
            args.query as string,
            args.before as number | undefined,
          ),
        )
      if (name === 'continue_task_history')
        return page(continueTaskHistory(storage.sql, args.cursor as string))
      const taskId = args.taskId as string
      const historical = readTaskObservation(
        storage.sql,
        taskId,
        args.observationId as string,
      )
      let value = historical.observation.value
      if (
        value &&
        typeof value === 'object' &&
        'kind' in value &&
        value.kind === 'stored-tool-result' &&
        'resultId' in value &&
        typeof value.resultId === 'string'
      ) {
        value = await durableResultStore(storage, taskId).get(value.resultId)
        if (value === undefined)
          throw new Error('Earlier stored result is unavailable.')
      }
      return {
        historical: true,
        taskId,
        request: historical.request,
        toolName: historical.observation.toolName,
        toolId: historical.observation.toolId,
        source: historical.observation.source,
        ok: historical.observation.ok,
        result: value,
      }
    },
  }))
}
