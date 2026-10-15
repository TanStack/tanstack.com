import { z } from 'zod'

const databaseName = 'tanstack-builder-project-pending-prompts'
const databaseVersion = 2
const objectStoreName = 'pending-prompts'
const storedPromptVersion = 2
const maxPendingPromptsPerProject = 100

const pendingPromptSchema = z
  .object({
    projectId: z.uuid(),
    promptId: z.uuid(),
    queueKind: z.enum(['active', 'steer', 'queue']),
    threadId: z.uuid(),
    threadCreateClientMutationId: z.uuid(),
    runEnqueueClientMutationId: z.uuid(),
    runClaimClientMutationId: z.uuid(),
    runCancelClientMutationId: z.uuid(),
    runId: z.uuid(),
    userMessageId: z.uuid(),
    userMessageClientMutationId: z.uuid(),
    content: z.string().trim().min(1).max(10_000),
    provider: z.string().min(1).max(50),
    model: z.string().min(1).max(100),
    leaseOwnerId: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict()

const storedPromptListSchema = z
  .object({
    version: z.literal(storedPromptVersion),
    projectId: z.uuid(),
    prompts: z.array(pendingPromptSchema).max(maxPendingPromptsPerProject),
  })
  .strict()

export type BuilderProjectPendingPrompt = z.infer<typeof pendingPromptSchema>

export class BuilderProjectPendingPromptUnavailableError extends Error {
  override readonly name = 'BuilderProjectPendingPromptUnavailableError'
}

export class BuilderProjectPendingPromptCapacityError extends Error {
  override readonly name = 'BuilderProjectPendingPromptCapacityError'
}

export async function saveBuilderProjectPendingPrompt(
  pendingPrompt: BuilderProjectPendingPrompt,
) {
  const parsedPrompt = pendingPromptSchema.parse(pendingPrompt)
  await withPendingPromptStore('readwrite', (store, finish, fail) => {
    const request = store.get(parsedPrompt.projectId)
    request.onsuccess = () => {
      const parsedList = storedPromptListSchema.safeParse(request.result)
      const prompts = parsedList.success ? [...parsedList.data.prompts] : []
      const existingIndex = prompts.findIndex(
        (candidate) => candidate.promptId === parsedPrompt.promptId,
      )
      if (existingIndex === -1) {
        if (prompts.length >= maxPendingPromptsPerProject) {
          fail(
            new BuilderProjectPendingPromptCapacityError(
              'Builder pending prompt capacity reached',
            ),
          )
          return
        }
        prompts.push(parsedPrompt)
      } else {
        prompts[existingIndex] = parsedPrompt
      }

      const putRequest = store.put(
        {
          version: storedPromptVersion,
          projectId: parsedPrompt.projectId,
          prompts,
        },
        parsedPrompt.projectId,
      )
      putRequest.onsuccess = () => finish(undefined)
      putRequest.onerror = () => fail(putRequest.error)
    }
    request.onerror = () => fail(request.error)
  })
  return parsedPrompt
}

export async function listBuilderProjectPendingPrompts(projectId: string) {
  const parsedProjectId = z.uuid().parse(projectId)
  return withPendingPromptStore<Array<BuilderProjectPendingPrompt>>(
    'readwrite',
    (store, finish, fail) => {
      const request = store.get(parsedProjectId)
      request.onsuccess = () => {
        const parsed = storedPromptListSchema.safeParse(request.result)
        if (parsed.success) {
          finish(parsed.data.prompts)
          return
        }
        if (request.result === undefined) {
          finish([])
          return
        }

        const deleteRequest = store.delete(parsedProjectId)
        deleteRequest.onsuccess = () => finish([])
        deleteRequest.onerror = () => fail(deleteRequest.error)
      }
      request.onerror = () => fail(request.error)
    },
  )
}

export async function loadBuilderProjectPendingPrompt(projectId: string) {
  const [pendingPrompt] = await listBuilderProjectPendingPrompts(projectId)
  return pendingPrompt
}

export async function clearBuilderProjectPendingPrompt(
  projectId: string,
  promptId?: string,
) {
  const parsedProjectId = z.uuid().parse(projectId)
  const parsedPromptId = promptId ? z.uuid().parse(promptId) : undefined
  return withPendingPromptStore<boolean>('readwrite', (store, finish, fail) => {
    const request = store.get(parsedProjectId)
    request.onsuccess = () => {
      const parsed = storedPromptListSchema.safeParse(request.result)
      if (!parsed.success) {
        if (request.result === undefined) {
          finish(false)
          return
        }
        const deleteRequest = store.delete(parsedProjectId)
        deleteRequest.onsuccess = () => finish(false)
        deleteRequest.onerror = () => fail(deleteRequest.error)
        return
      }
      if (!parsedPromptId) {
        const deleteRequest = store.delete(parsedProjectId)
        deleteRequest.onsuccess = () => finish(parsed.data.prompts.length > 0)
        deleteRequest.onerror = () => fail(deleteRequest.error)
        return
      }

      const prompts = parsed.data.prompts.filter(
        (candidate) => candidate.promptId !== parsedPromptId,
      )
      if (prompts.length === parsed.data.prompts.length) {
        finish(false)
        return
      }
      const writeRequest =
        prompts.length === 0
          ? store.delete(parsedProjectId)
          : store.put({ ...parsed.data, prompts }, parsedProjectId)
      writeRequest.onsuccess = () => finish(true)
      writeRequest.onerror = () => fail(writeRequest.error)
    }
    request.onerror = () => fail(request.error)
  })
}

function withPendingPromptStore<TResult>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    finish: (value: TResult) => void,
    fail: (error: unknown) => void,
  ) => void,
) {
  return openPendingPromptDatabase().then(
    (database) =>
      new Promise<TResult>((resolve, reject) => {
        const transaction = database.transaction(objectStoreName, mode)
        const store = transaction.objectStore(objectStoreName)
        let result: { ready: false } | { ready: true; value: TResult } = {
          ready: false,
        }
        let failed = false

        const fail = (error: unknown) => {
          if (failed) return
          failed = true
          try {
            transaction.abort()
          } catch {
            // The transaction may already be inactive.
          }
          reject(
            error ??
              new BuilderProjectPendingPromptUnavailableError(
                'Builder pending prompt storage failed',
              ),
          )
        }
        const finish = (value: TResult) => {
          result = { ready: true, value }
        }

        transaction.oncomplete = () => {
          if (failed) return
          if (!result.ready) {
            reject(
              new BuilderProjectPendingPromptUnavailableError(
                'Builder pending prompt storage completed without a result',
              ),
            )
            return
          }
          resolve(result.value)
        }
        transaction.onerror = () => fail(transaction.error)
        transaction.onabort = () => fail(transaction.error)

        try {
          operation(store, finish, fail)
        } catch (error) {
          fail(error)
        }
      }),
  )
}

function openPendingPromptDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new BuilderProjectPendingPromptUnavailableError(
        'Builder pending prompt storage is unavailable',
      ),
    )
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      reject(
        new BuilderProjectPendingPromptUnavailableError(
          'Builder pending prompt storage is blocked',
        ),
      )
    }
  })
}
