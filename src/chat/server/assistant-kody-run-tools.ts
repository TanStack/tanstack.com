import type { KodyEnvironment } from './kody'
import { toolDefinition } from '@tanstack/ai'
import { kodyRunHistoryFilterSchema } from '../core/kody-run-history'
import { kodyCall } from './kody'
import type {
  KodyReferenceOptions,
  KodyReferenceScope,
} from './kody-reference-access'
import { readKodyRunHistory } from './kody-run-history'
import { KodyRunError } from './kody-run'

export function assistantKodyRunTools(input: {
  env: KodyEnvironment
  scope: KodyReferenceScope
  options: KodyReferenceOptions
  signal: AbortSignal
  call: typeof kodyCall
  assertCurrent: () => void
}) {
  return [
    toolDefinition({
      name: 'list_kody_runs',
      description:
        'Page through this Kody account’s retained run history. Optionally filter by status and surface. Returns up to 25 user-visible runs and a nextCursor; pass that cursor back with the same filters to continue. This is not free-text search, and one page is not the whole history. To inspect an exact returned run and its bounded logs, use kody_inspect with run:<id>.',
      inputSchema: kodyRunHistoryFilterSchema.strict(),
    }).server(async (args) => {
      input.assertCurrent()
      try {
        const page = await readKodyRunHistory(
          input.env,
          input.scope,
          input.options,
          args,
          input.signal,
          input.call,
        )
        input.assertCurrent()
        return {
          ok: true as const,
          scope: 'kody-account',
          filters: {
            status: args.status ?? null,
            surface: args.surface ?? null,
          },
          page,
          complete: page.nextCursor === null,
        }
      } catch (error) {
        input.assertCurrent()
        return {
          ok: false as const,
          error:
            error instanceof KodyRunError
              ? error.message
              : 'Kody run history could not be read right now.',
        }
      }
    }),
  ]
}
