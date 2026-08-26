import { createFileRoute } from '@tanstack/react-router'
import {
  jsonError,
  jsonResponse,
  validateSameOriginRequest,
} from '~/utils/api-boundary.server'
import {
  purgeHostingCacheTags,
  type PurgeResult,
} from '~/utils/hosting-cache.server'
import {
  getBuilderProjectSnapshotCacheTag,
  isBuilderProjectSnapshotHash,
  isBuilderProjectSnapshotQuarantined,
  BuilderProjectSnapshotStorageUnavailableError,
  quarantineBuilderProjectSnapshot,
} from '~/utils/builder-project-snapshot-storage.server'
import {
  BuilderProjectStorageUnavailableError,
  quarantineStoredBuilderProjectsBySnapshotHash,
} from '~/utils/builder-project-storage.server'
import { quarantineBuilderProjectsBySnapshotHash } from '~/utils/builder-project-events.server'

export type BuilderProjectQuarantineOperations = {
  quarantineSnapshot: (hash: string, userId: string) => Promise<boolean>
  isSnapshotQuarantined: (hash: string) => Promise<boolean>
  purgeCacheTags: (tags: Array<string>) => Promise<PurgeResult>
  quarantineProjects: (input: {
    snapshotHash: string
    actorId: string
  }) => Promise<Array<string>>
  quarantineStableProjects: (
    snapshotHash: string,
    actorId: string,
  ) => Promise<number>
}

export const builderProjectQuarantineOperations: BuilderProjectQuarantineOperations =
  {
    quarantineSnapshot: quarantineBuilderProjectSnapshot,
    isSnapshotQuarantined: isBuilderProjectSnapshotQuarantined,
    purgeCacheTags: purgeHostingCacheTags,
    quarantineProjects: quarantineBuilderProjectsBySnapshotHash,
    quarantineStableProjects: quarantineStoredBuilderProjectsBySnapshotHash,
  }

export class BuilderProjectQuarantineCleanupError extends Error {
  constructor(readonly failures: Array<unknown>) {
    super('Builder project quarantine cleanup did not finish')
    this.name = 'BuilderProjectQuarantineCleanupError'
  }
}

export async function quarantineBuilderProjectSnapshotForAdmin({
  hash,
  actorId,
}: {
  hash: string
  actorId: string
}) {
  const operations = builderProjectQuarantineOperations
  const failures: Array<unknown> = []
  let tombstoned = false
  try {
    await operations.quarantineSnapshot(hash, actorId)
    tombstoned = true
  } catch (error) {
    failures.push(error)
  }

  const purge = await operations.purgeCacheTags([
    getBuilderProjectSnapshotCacheTag(hash),
  ])
  if (!purge.purged) failures.push(new Error('Cache purge failed'))
  if (!tombstoned) {
    try {
      tombstoned = await operations.isSnapshotQuarantined(hash)
    } catch (statusError) {
      failures.push(statusError)
    }
  }
  if (!tombstoned) {
    throw new BuilderProjectQuarantineCleanupError(failures)
  }

  let projectsQuarantined: Array<string> = []
  try {
    projectsQuarantined = await operations.quarantineProjects({
      snapshotHash: hash,
      actorId,
    })
  } catch (error) {
    failures.push(error)
  }

  let stableRecordsQuarantined = 0
  try {
    stableRecordsQuarantined =
      await operations.quarantineStableProjects(hash, actorId)
  } catch (error) {
    failures.push(error)
  }

  if (failures.length > 0) {
    throw new BuilderProjectQuarantineCleanupError(failures)
  }
  return { projectsQuarantined, purge, stableRecordsQuarantined }
}

export const Route = createFileRoute(
  '/api/builder/project-snapshots/$hash/quarantine',
)({
  server: {
    handlers: {
      POST: async ({
        params,
        request,
      }: {
        params: { hash: string }
        request: Request
      }) => {
        const requestError = validateSameOriginRequest(request)
        if (requestError) {
          return jsonError(requestError.message, requestError.status)
        }
        if (!isBuilderProjectSnapshotHash(params.hash)) {
          return jsonError('Builder project not found', 404)
        }

        const { getAuthService } = await import('~/auth/index.server')
        const user = await getAuthService().getCurrentUser(request)
        if (!user) {
          return jsonError('Not authenticated', 401)
        }
        if (!user.capabilities.includes('admin')) {
          return jsonError('Not authorized', 403)
        }

        try {
          const { projectsQuarantined, purge, stableRecordsQuarantined } =
            await quarantineBuilderProjectSnapshotForAdmin({
              hash: params.hash,
              actorId: user.userId,
            })
          return jsonResponse({
            purge,
            quarantined: true,
            projectsQuarantined: projectsQuarantined.length,
            stableRecordsQuarantined,
          })
        } catch (error) {
          if (error instanceof BuilderProjectQuarantineCleanupError) {
            for (const failure of error.failures) {
              console.error(
                'Builder project quarantine cleanup failed:',
                failure,
              )
            }
            return jsonError('Builder quarantine cleanup is unavailable', 503)
          }
          if (
            error instanceof BuilderProjectSnapshotStorageUnavailableError ||
            error instanceof BuilderProjectStorageUnavailableError
          ) {
            return jsonError('Builder storage is unavailable', 503)
          }
          console.error('Failed to quarantine builder project:', error)
          return jsonError('Failed to quarantine builder project', 500)
        }
      },
    },
  },
})
