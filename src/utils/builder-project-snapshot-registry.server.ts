import {
  and,
  eq,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '~/db/client'
import {
  builderProjectSnapshotReservations,
  builderProjectSnapshots,
  builderProjectRevisions,
  builderProjects,
  users,
} from '~/db/schema'
import type { SharedExampleProject } from './example-project'
import {
  BuilderProjectSnapshotQuarantinedError,
  deleteBuilderProjectSnapshotObject,
  getBuilderProjectSnapshotObject,
  hasLegacyBuilderProjectSnapshotReference,
  isBuilderProjectSnapshotQuarantined,
  prepareBuilderProjectSnapshot,
  storePreparedBuilderProjectSnapshot,
  type PreparedBuilderProjectSnapshot,
} from './builder-project-snapshot-storage.server'

export const builderProjectSnapshotOwnerLimits = {
  snapshots: 4_096,
  sourceBytes: 512 * 1024 * 1024,
} as const

export type BuilderProjectSnapshotOwnerUsage = {
  snapshots: number
  sourceBytes: number
}

export class BuilderProjectSnapshotLimitError extends Error {
  constructor(readonly resource: keyof BuilderProjectSnapshotOwnerUsage) {
    super(`Builder project snapshot ${resource} quota reached`)
    this.name = 'BuilderProjectSnapshotLimitError'
  }
}

export class BuilderProjectSnapshotRegistryConflictError extends Error {
  constructor() {
    super('Builder project snapshot conflicts with the stored registry')
    this.name = 'BuilderProjectSnapshotRegistryConflictError'
  }
}

export function assertBuilderProjectSnapshotOwnerUsage(
  usage: BuilderProjectSnapshotOwnerUsage,
) {
  if (usage.snapshots > builderProjectSnapshotOwnerLimits.snapshots) {
    throw new BuilderProjectSnapshotLimitError('snapshots')
  }
  if (usage.sourceBytes > builderProjectSnapshotOwnerLimits.sourceBytes) {
    throw new BuilderProjectSnapshotLimitError('sourceBytes')
  }
}

export async function storeBuilderProjectSnapshotForOwner(
  ownerId: string,
  project: SharedExampleProject,
) {
  const snapshot = await prepareBuilderProjectSnapshot(project)
  await reserveBuilderProjectSnapshot(ownerId, snapshot)

  try {
    const stored = await storePreparedBuilderProjectSnapshot(snapshot)
    await markBuilderProjectSnapshotStored(snapshot.hash)
    return stored
  } catch (error) {
    if (error instanceof BuilderProjectSnapshotQuarantinedError) {
      await quarantineBuilderProjectSnapshotInRegistry(snapshot.hash)
    }
    throw error
  }
}

export async function reserveBuilderProjectSnapshot(
  ownerId: string,
  snapshot: PreparedBuilderProjectSnapshot,
) {
  return db.transaction(async (transaction) => {
    const [owner] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ownerId))
      .for('update')
      .limit(1)
    if (!owner) throw new BuilderProjectSnapshotRegistryConflictError()

    const now = new Date()
    await transaction
      .insert(builderProjectSnapshots)
      .values({
        hash: snapshot.hash,
        sourceBytes: snapshot.sourceBytes,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()

    const [registered] = await transaction
      .select()
      .from(builderProjectSnapshots)
      .where(eq(builderProjectSnapshots.hash, snapshot.hash))
      .for('update')
      .limit(1)
    if (!registered) throw new BuilderProjectSnapshotRegistryConflictError()
    if (registered.quarantinedAt) {
      throw new BuilderProjectSnapshotQuarantinedError()
    }
    if (registered.deletingAt) {
      throw new BuilderProjectSnapshotRegistryConflictError()
    }
    if (
      registered.sourceBytes !== null &&
      registered.sourceBytes !== snapshot.sourceBytes
    ) {
      throw new BuilderProjectSnapshotRegistryConflictError()
    }

    const [existing] = await transaction
      .select({ id: builderProjectSnapshotReservations.id })
      .from(builderProjectSnapshotReservations)
      .where(
        and(
          eq(builderProjectSnapshotReservations.ownerId, ownerId),
          eq(builderProjectSnapshotReservations.snapshotHash, snapshot.hash),
        ),
      )
      .limit(1)
    if (existing) {
      await transaction
        .update(builderProjectSnapshotReservations)
        .set({ updatedAt: now })
        .where(eq(builderProjectSnapshotReservations.id, existing.id))
      await transaction
        .update(builderProjectSnapshots)
        .set({
          sourceBytes: snapshot.sourceBytes,
          updatedAt: now,
        })
        .where(eq(builderProjectSnapshots.hash, snapshot.hash))
      return { created: false, hash: snapshot.hash }
    }

    const [usage] = await transaction
      .select({
        snapshots: sql<number>`count(*)::int`,
        sourceBytes: sql<number>`COALESCE(sum(COALESCE(${builderProjectSnapshots.sourceBytes}, 1048576)), 0)::int`,
      })
      .from(builderProjectSnapshotReservations)
      .innerJoin(
        builderProjectSnapshots,
        eq(
          builderProjectSnapshots.hash,
          builderProjectSnapshotReservations.snapshotHash,
        ),
      )
      .where(eq(builderProjectSnapshotReservations.ownerId, ownerId))
    assertBuilderProjectSnapshotOwnerUsage({
      snapshots: (usage?.snapshots ?? 0) + 1,
      sourceBytes: (usage?.sourceBytes ?? 0) + snapshot.sourceBytes,
    })

    await transaction.insert(builderProjectSnapshotReservations).values({
      ownerId,
      snapshotHash: snapshot.hash,
      createdAt: now,
      updatedAt: now,
    })
    await transaction
      .update(builderProjectSnapshots)
      .set({
        sourceBytes: snapshot.sourceBytes,
        updatedAt: now,
      })
      .where(eq(builderProjectSnapshots.hash, snapshot.hash))
    return { created: true, hash: snapshot.hash }
  })
}

export async function registerLegacyBuilderProjectSnapshot(
  ownerId: string,
  snapshotHash: string,
) {
  const object = await getBuilderProjectSnapshotObject(snapshotHash)
  if (!object) {
    if (await isBuilderProjectSnapshotQuarantined(snapshotHash)) {
      await quarantineBuilderProjectSnapshotInRegistry(snapshotHash)
      throw new BuilderProjectSnapshotQuarantinedError()
    }
    throw new BuilderProjectSnapshotRegistryConflictError()
  }
  await object.body?.cancel()

  return db.transaction(async (transaction) => {
    const [owner] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ownerId))
      .for('update')
      .limit(1)
    if (!owner) throw new BuilderProjectSnapshotRegistryConflictError()

    const now = new Date()
    await transaction
      .insert(builderProjectSnapshots)
      .values({
        hash: snapshotHash,
        storedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
    const [registered] = await transaction
      .select()
      .from(builderProjectSnapshots)
      .where(eq(builderProjectSnapshots.hash, snapshotHash))
      .for('update')
      .limit(1)
    if (!registered) throw new BuilderProjectSnapshotRegistryConflictError()
    if (registered.quarantinedAt) {
      throw new BuilderProjectSnapshotQuarantinedError()
    }
    if (registered.deletingAt) {
      throw new BuilderProjectSnapshotRegistryConflictError()
    }

    await transaction
      .update(builderProjectSnapshots)
      .set({ storedAt: registered.storedAt ?? now, updatedAt: now })
      .where(eq(builderProjectSnapshots.hash, snapshotHash))

    const [existing] = await transaction
      .select({ id: builderProjectSnapshotReservations.id })
      .from(builderProjectSnapshotReservations)
      .where(
        and(
          eq(builderProjectSnapshotReservations.ownerId, ownerId),
          eq(builderProjectSnapshotReservations.snapshotHash, snapshotHash),
        ),
      )
      .limit(1)
    if (existing) {
      await transaction
        .update(builderProjectSnapshotReservations)
        .set({ updatedAt: now })
        .where(eq(builderProjectSnapshotReservations.id, existing.id))
      return { created: false, hash: snapshotHash }
    }

    const [usage] = await transaction
      .select({
        snapshots: sql<number>`count(*)::int`,
        sourceBytes: sql<number>`COALESCE(sum(COALESCE(${builderProjectSnapshots.sourceBytes}, 1048576)), 0)::int`,
      })
      .from(builderProjectSnapshotReservations)
      .innerJoin(
        builderProjectSnapshots,
        eq(
          builderProjectSnapshots.hash,
          builderProjectSnapshotReservations.snapshotHash,
        ),
      )
      .where(eq(builderProjectSnapshotReservations.ownerId, ownerId))
    assertBuilderProjectSnapshotOwnerUsage({
      snapshots: (usage?.snapshots ?? 0) + 1,
      sourceBytes: (usage?.sourceBytes ?? 0) + 1024 * 1024,
    })

    await transaction.insert(builderProjectSnapshotReservations).values({
      ownerId,
      snapshotHash,
      createdAt: now,
      updatedAt: now,
    })
    return { created: true, hash: snapshotHash }
  })
}

export async function markBuilderProjectSnapshotStored(
  snapshotHash: string,
  storedAt = new Date(),
) {
  const [snapshot] = await db
    .update(builderProjectSnapshots)
    .set({ storedAt, updatedAt: storedAt })
    .where(
      and(
        eq(builderProjectSnapshots.hash, snapshotHash),
        isNull(builderProjectSnapshots.quarantinedAt),
        isNull(builderProjectSnapshots.deletingAt),
      ),
    )
    .returning({ hash: builderProjectSnapshots.hash })
  if (!snapshot) throw new BuilderProjectSnapshotQuarantinedError()
}

export async function quarantineBuilderProjectSnapshotInRegistry(
  snapshotHash: string,
  quarantinedAt = new Date(),
) {
  await db.transaction(async (transaction) => {
    await transaction
      .insert(builderProjectSnapshots)
      .values({
        hash: snapshotHash,
        quarantinedAt,
        createdAt: quarantinedAt,
        updatedAt: quarantinedAt,
      })
      .onConflictDoUpdate({
        target: builderProjectSnapshots.hash,
        set: {
          quarantinedAt,
          deletingAt: null,
          updatedAt: quarantinedAt,
        },
      })
    await transaction
      .delete(builderProjectSnapshotReservations)
      .where(eq(builderProjectSnapshotReservations.snapshotHash, snapshotHash))
  })
}

type BuilderProjectSnapshotReader = Pick<typeof db, 'select'>

type BuilderProjectSnapshotGcReader = Pick<typeof db, 'select'>

type BuilderProjectSnapshotGcWriter = Pick<typeof db, 'update'>

export async function assertBuilderProjectSnapshotAvailable(
  snapshotHash: string,
  database: BuilderProjectSnapshotReader = db,
) {
  const [snapshot] = await database
    .select({ hash: builderProjectSnapshots.hash })
    .from(builderProjectSnapshots)
    .where(
      and(
        eq(builderProjectSnapshots.hash, snapshotHash),
        isNotNull(builderProjectSnapshots.storedAt),
        isNull(builderProjectSnapshots.quarantinedAt),
        isNull(builderProjectSnapshots.deletingAt),
      ),
    )
    .for('share')
    .limit(1)
  if (!snapshot) throw new BuilderProjectSnapshotRegistryConflictError()
}

export async function reconcileBuilderProjectSnapshotReservations({
  occurredAt = new Date(),
  limit = 25,
}: {
  occurredAt?: Date
  limit?: number
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid Builder snapshot reconciliation limit')
  }

  const cutoff = new Date(occurredAt.getTime() - 24 * 60 * 60 * 1_000)
  const pending = await db
    .select({ hash: builderProjectSnapshots.hash })
    .from(builderProjectSnapshots)
    .where(
      and(
        isNull(builderProjectSnapshots.storedAt),
        isNull(builderProjectSnapshots.quarantinedAt),
        isNull(builderProjectSnapshots.deletingAt),
        lte(builderProjectSnapshots.updatedAt, cutoff),
      ),
    )
    .orderBy(builderProjectSnapshots.updatedAt)
    .limit(limit)

  let stored = 0
  let released = 0
  let quarantined = 0
  for (const snapshot of pending) {
    if (await isBuilderProjectSnapshotQuarantined(snapshot.hash)) {
      await quarantineBuilderProjectSnapshotInRegistry(
        snapshot.hash,
        occurredAt,
      )
      quarantined += 1
      continue
    }

    const object = await getBuilderProjectSnapshotObject(snapshot.hash)
    if (object) {
      await object.body?.cancel()
      await markBuilderProjectSnapshotStored(snapshot.hash, occurredAt)
      stored += 1
      continue
    }

    const removed = await db
      .delete(builderProjectSnapshots)
      .where(
        and(
          eq(builderProjectSnapshots.hash, snapshot.hash),
          isNull(builderProjectSnapshots.storedAt),
          isNull(builderProjectSnapshots.quarantinedAt),
          isNull(builderProjectSnapshots.deletingAt),
          lte(builderProjectSnapshots.updatedAt, cutoff),
        ),
      )
      .returning({ hash: builderProjectSnapshots.hash })
    released += removed.length
  }

  return { quarantined, released, stored }
}

export async function pruneBuilderProjectSnapshotStorage({
  occurredAt = new Date(),
  limit = 25,
}: {
  occurredAt?: Date
  limit?: number
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid Builder snapshot prune limit')
  }
  const cutoff = new Date(occurredAt.getTime() - 30 * 24 * 60 * 60 * 1_000)
  const reservations = await getBuilderProjectSnapshotReservationGcCandidates({
    cutoff,
    limit,
  })

  let reservationsReleased = 0
  for (const candidate of reservations) {
    reservationsReleased += await db.transaction(async (transaction) => {
      const [owner] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, candidate.ownerId))
        .for('update')
        .limit(1)
      if (!owner) return 0
      const [reservation] = await transaction
        .select()
        .from(builderProjectSnapshotReservations)
        .where(eq(builderProjectSnapshotReservations.id, candidate.id))
        .for('update')
        .limit(1)
      if (!reservation || reservation.updatedAt > cutoff) return 0

      const [reference] = await transaction
        .select({ id: builderProjects.id })
        .from(builderProjects)
        .leftJoin(
          builderProjectRevisions,
          and(
            eq(builderProjectRevisions.projectId, builderProjects.id),
            eq(builderProjectRevisions.snapshotHash, candidate.snapshotHash),
          ),
        )
        .where(
          and(
            eq(builderProjects.ownerId, candidate.ownerId),
            or(
              eq(builderProjects.snapshotHash, candidate.snapshotHash),
              isNotNull(builderProjectRevisions.id),
            ),
          ),
        )
        .limit(1)
      if (reference) return 0
      const removed = await transaction
        .delete(builderProjectSnapshotReservations)
        .where(eq(builderProjectSnapshotReservations.id, reservation.id))
        .returning({ id: builderProjectSnapshotReservations.id })
      return removed.length
    })
  }

  const snapshots = await getBuilderProjectSnapshotGcCandidates({
    cutoff,
    limit,
  })

  let snapshotsDeleted = 0
  let snapshotsFailed = 0
  for (const candidate of snapshots) {
    const deleting = await db.transaction(async (transaction) => {
      const [snapshot] = await transaction
        .select()
        .from(builderProjectSnapshots)
        .where(eq(builderProjectSnapshots.hash, candidate.hash))
        .for('update')
        .limit(1)
      if (!snapshot || snapshot.quarantinedAt) return false
      if (snapshot.deletingAt) return true
      if (!snapshot.storedAt || snapshot.updatedAt > cutoff) return false

      const [projectReference] = await transaction
        .select({ id: builderProjects.id })
        .from(builderProjects)
        .leftJoin(
          builderProjectRevisions,
          and(
            eq(builderProjectRevisions.projectId, builderProjects.id),
            eq(builderProjectRevisions.snapshotHash, snapshot.hash),
          ),
        )
        .where(
          or(
            eq(builderProjects.snapshotHash, snapshot.hash),
            isNotNull(builderProjectRevisions.id),
          ),
        )
        .limit(1)
      if (projectReference) return false
      const [reservation] = await transaction
        .select({ id: builderProjectSnapshotReservations.id })
        .from(builderProjectSnapshotReservations)
        .where(
          eq(builderProjectSnapshotReservations.snapshotHash, snapshot.hash),
        )
        .limit(1)
      if (reservation) return false

      await transaction
        .update(builderProjectSnapshots)
        .set({ deletingAt: occurredAt, updatedAt: occurredAt })
        .where(eq(builderProjectSnapshots.hash, snapshot.hash))
      return true
    })
    if (!deleting) continue

    if (await hasLegacyBuilderProjectSnapshotReference(candidate.hash)) {
      await deferLegacyReferencedBuilderProjectSnapshotGcCandidate({
        hash: candidate.hash,
        occurredAt,
      })
      continue
    }

    try {
      await deleteBuilderProjectSnapshotObject(candidate.hash)
    } catch (error) {
      snapshotsFailed += 1
      console.error(
        `Failed to delete Builder project snapshot ${candidate.hash}:`,
        error,
      )
      continue
    }
    const removed = await db
      .delete(builderProjectSnapshots)
      .where(
        and(
          eq(builderProjectSnapshots.hash, candidate.hash),
          isNotNull(builderProjectSnapshots.deletingAt),
          notExists(
            db
              .select({ id: builderProjectRevisions.id })
              .from(builderProjectRevisions)
              .where(
                eq(
                  builderProjectRevisions.snapshotHash,
                  builderProjectSnapshots.hash,
                ),
              ),
          ),
          notExists(
            db
              .select({ id: builderProjects.id })
              .from(builderProjects)
              .where(
                eq(builderProjects.snapshotHash, builderProjectSnapshots.hash),
              ),
          ),
          notExists(
            db
              .select({ id: builderProjectSnapshotReservations.id })
              .from(builderProjectSnapshotReservations)
              .where(
                eq(
                  builderProjectSnapshotReservations.snapshotHash,
                  builderProjectSnapshots.hash,
                ),
              ),
          ),
        ),
      )
      .returning({ hash: builderProjectSnapshots.hash })
    snapshotsDeleted += removed.length
  }

  return { reservationsReleased, snapshotsDeleted, snapshotsFailed }
}

export function deferLegacyReferencedBuilderProjectSnapshotGcCandidate({
  hash,
  occurredAt,
  database = db,
}: {
  hash: string
  occurredAt: Date
  database?: BuilderProjectSnapshotGcWriter
}) {
  return database
    .update(builderProjectSnapshots)
    .set({ deletingAt: null, updatedAt: occurredAt })
    .where(
      and(
        eq(builderProjectSnapshots.hash, hash),
        isNull(builderProjectSnapshots.quarantinedAt),
      ),
    )
}

export function getBuilderProjectSnapshotReservationGcCandidates({
  cutoff,
  limit,
  database = db,
}: {
  cutoff: Date
  limit: number
  database?: BuilderProjectSnapshotGcReader
}) {
  return database
    .select({
      id: builderProjectSnapshotReservations.id,
      ownerId: builderProjectSnapshotReservations.ownerId,
      snapshotHash: builderProjectSnapshotReservations.snapshotHash,
    })
    .from(builderProjectSnapshotReservations)
    .where(
      and(
        lte(builderProjectSnapshotReservations.updatedAt, cutoff),
        notExists(
          database
            .select({ id: builderProjects.id })
            .from(builderProjects)
            .leftJoin(
              builderProjectRevisions,
              and(
                eq(builderProjectRevisions.projectId, builderProjects.id),
                eq(
                  builderProjectRevisions.snapshotHash,
                  builderProjectSnapshotReservations.snapshotHash,
                ),
              ),
            )
            .where(
              and(
                eq(
                  builderProjects.ownerId,
                  builderProjectSnapshotReservations.ownerId,
                ),
                or(
                  eq(
                    builderProjects.snapshotHash,
                    builderProjectSnapshotReservations.snapshotHash,
                  ),
                  isNotNull(builderProjectRevisions.id),
                ),
              ),
            ),
        ),
      ),
    )
    .orderBy(builderProjectSnapshotReservations.updatedAt)
    .limit(limit)
}

export function getBuilderProjectSnapshotGcCandidates({
  cutoff,
  limit,
  database = db,
}: {
  cutoff: Date
  limit: number
  database?: BuilderProjectSnapshotGcReader
}) {
  return database
    .select({ hash: builderProjectSnapshots.hash })
    .from(builderProjectSnapshots)
    .where(
      and(
        isNull(builderProjectSnapshots.quarantinedAt),
        notExists(
          database
            .select({ id: builderProjectRevisions.id })
            .from(builderProjectRevisions)
            .where(
              eq(
                builderProjectRevisions.snapshotHash,
                builderProjectSnapshots.hash,
              ),
            ),
        ),
        notExists(
          database
            .select({ id: builderProjects.id })
            .from(builderProjects)
            .where(
              eq(builderProjects.snapshotHash, builderProjectSnapshots.hash),
            ),
        ),
        notExists(
          database
            .select({ id: builderProjectSnapshotReservations.id })
            .from(builderProjectSnapshotReservations)
            .where(
              eq(
                builderProjectSnapshotReservations.snapshotHash,
                builderProjectSnapshots.hash,
              ),
            ),
        ),
        or(
          isNotNull(builderProjectSnapshots.deletingAt),
          and(
            isNotNull(builderProjectSnapshots.storedAt),
            lte(builderProjectSnapshots.updatedAt, cutoff),
          ),
        ),
      ),
    )
    .orderBy(builderProjectSnapshots.updatedAt)
    .limit(limit)
}
