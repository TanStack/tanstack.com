import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  getTableColumns,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { db } from '~/db/client'
import {
  builderProjectEvents,
  builderProjectMessages,
  builderProjectMutationReceipts,
  builderProjectRevisions,
  builderProjectRuns,
  builderProjectSnapshotReservations,
  builderProjectSnapshots,
  builderProjectTombstones,
  builderProjectUsage,
  builderProjects,
  builderProjectThreads,
  users,
  type BuilderProjectEventRow,
} from '~/db/schema'
import type {
  BuilderJsonObject,
  BuilderJsonValue,
  BuilderProjectEventType,
} from '~/db/types'
import {
  assertBuilderProjectEventPayload,
  builderProjectEventReplayMaxLimit,
  builderProjectEventVersion,
  type BuilderProjectEvent,
} from './builder-project-events'
import {
  builderProjectSyncSnapshotContinuationMaxCharacters,
  builderProjectSyncSnapshotPageMaxRows,
  takeBuilderProjectSyncSnapshotPageRows,
  type BuilderProjectSyncSnapshotContinuation,
} from './builder-project-sync'
import { assertBuilderProjectSnapshotAvailable } from './builder-project-snapshot-registry.server'
import { sha256Hex } from './hash'

type BuilderProjectTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]

export class BuilderProjectNotFoundError extends Error {
  constructor() {
    super('Builder project not found')
    this.name = 'BuilderProjectNotFoundError'
  }
}

export class BuilderProjectOwnershipError extends Error {
  constructor() {
    super('Builder project belongs to another user')
    this.name = 'BuilderProjectOwnershipError'
  }
}

export class BuilderProjectConflictError extends Error {
  constructor(message = 'Builder project state changed') {
    super(message)
    this.name = 'BuilderProjectConflictError'
  }
}

export class BuilderProjectRevisionConflictError extends BuilderProjectConflictError {
  constructor(
    message = 'Builder project revision changed',
    readonly sequence?: number,
  ) {
    super(message)
    this.name = 'BuilderProjectRevisionConflictError'
  }
}

export class BuilderProjectDeletedError extends BuilderProjectConflictError {
  constructor() {
    super('Builder project is deleted')
    this.name = 'BuilderProjectDeletedError'
  }
}

export class BuilderProjectLeaseError extends BuilderProjectConflictError {
  constructor(message = 'Builder project run lease is no longer valid') {
    super(message)
    this.name = 'BuilderProjectLeaseError'
  }
}

export type BuilderProjectMutationCommandType =
  | 'project.create'
  | 'project.revise'
  | 'project.delete'
  | 'thread.create'
  | 'run.enqueue'
  | 'run.claim'
  | 'run.cancel'
  | 'run.finish'
  | 'run.finish.fallback'
  | 'transcript.import'

export function getBuilderProjectMutationRequestHash(value: unknown) {
  return sha256Hex(canonicalBuilderMutationJson(value))
}

export function isMatchingBuilderProjectMutationReceipt(
  expected: {
    commandType: BuilderProjectMutationCommandType
    requestHash: string
  },
  existing: { commandType: string; requestHash: string },
) {
  return (
    existing.commandType === expected.commandType &&
    existing.requestHash === expected.requestHash
  )
}

export const builderProjectOwnerLimit = 100

export const builderProjectQuotaLimits = {
  threads: 500,
  messages: 20_000,
  runs: 10_000,
  revisions: 2_000,
  events: 100_000,
  payloadBytes: 256 * 1024 * 1024,
} as const

export const builderProjectQuotaHardLimits = {
  ...builderProjectQuotaLimits,
  messages: builderProjectQuotaLimits.messages + 1,
  revisions: builderProjectQuotaLimits.revisions + 1,
  events: builderProjectQuotaLimits.events + 8,
  payloadBytes: builderProjectQuotaLimits.payloadBytes + 4 * 1024 * 1024,
} as const

export type BuilderProjectQuotaUsage = {
  threads: number
  messages: number
  runs: number
  revisions: number
  events: number
  payloadBytes: number
}

export class BuilderProjectLimitError extends BuilderProjectConflictError {
  constructor(
    message = `Builder project limit of ${builderProjectOwnerLimit} reached`,
  ) {
    super(message)
    this.name = 'BuilderProjectLimitError'
  }
}

export class BuilderProjectQuotaError extends BuilderProjectConflictError {
  constructor(readonly resource: keyof BuilderProjectQuotaUsage) {
    super(`Builder project ${resource} quota reached`)
    this.name = 'BuilderProjectQuotaError'
  }
}

export function assertBuilderProjectQuotaUsage(
  usage: BuilderProjectQuotaUsage,
) {
  if (usage.threads > builderProjectQuotaLimits.threads)
    throw new BuilderProjectQuotaError('threads')
  if (usage.messages > builderProjectQuotaLimits.messages)
    throw new BuilderProjectQuotaError('messages')
  if (usage.runs > builderProjectQuotaLimits.runs)
    throw new BuilderProjectQuotaError('runs')
  if (usage.revisions > builderProjectQuotaLimits.revisions)
    throw new BuilderProjectQuotaError('revisions')
  if (usage.events > builderProjectQuotaLimits.events)
    throw new BuilderProjectQuotaError('events')
  if (usage.payloadBytes > builderProjectQuotaLimits.payloadBytes)
    throw new BuilderProjectQuotaError('payloadBytes')
}

export function assertBuilderProjectQuotaHardUsage(
  usage: BuilderProjectQuotaUsage,
) {
  if (usage.threads > builderProjectQuotaHardLimits.threads)
    throw new BuilderProjectQuotaError('threads')
  if (usage.messages > builderProjectQuotaHardLimits.messages)
    throw new BuilderProjectQuotaError('messages')
  if (usage.runs > builderProjectQuotaHardLimits.runs)
    throw new BuilderProjectQuotaError('runs')
  if (usage.revisions > builderProjectQuotaHardLimits.revisions)
    throw new BuilderProjectQuotaError('revisions')
  if (usage.events > builderProjectQuotaHardLimits.events)
    throw new BuilderProjectQuotaError('events')
  if (usage.payloadBytes > builderProjectQuotaHardLimits.payloadBytes)
    throw new BuilderProjectQuotaError('payloadBytes')
}

export type BuilderProjectState = Awaited<
  ReturnType<typeof selectBuilderProjectState>
>

type AppendBuilderProjectEventInput = {
  projectId: string
  ownerId: string
  clientEventId: string
  clientMutationId?: string
  browserSessionId?: string
  threadId?: string
  revisionId?: string
  messageId?: string
  runId?: string
  type: BuilderProjectEventType
  payload: BuilderJsonObject
  occurredAt?: Date
  skipUsage?: boolean
  allowQuotaOverflow?: boolean
}

export async function appendBuilderProjectEvent(
  input: AppendBuilderProjectEventInput,
) {
  assertBuilderProjectEventPayload(input.payload)

  return withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        await lockOwnedProject(transaction, input.projectId, input.ownerId)
        return appendEventInTransaction(transaction, input)
      }),
    'Builder event conflicts with existing project state',
  )
}

export async function listBuilderProjectEvents({
  projectId,
  ownerId,
  afterSequence = 0,
  limit = 100,
}: {
  projectId: string
  ownerId: string
  afterSequence?: number
  limit?: number
}) {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new Error('Invalid Builder project event cursor')
  }
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > builderProjectEventReplayMaxLimit
  ) {
    throw new Error('Invalid Builder project event limit')
  }

  const rows = await db
    .select(getTableColumns(builderProjectEvents))
    .from(builderProjectEvents)
    .innerJoin(
      builderProjects,
      and(
        eq(builderProjects.id, builderProjectEvents.projectId),
        eq(builderProjects.ownerId, ownerId),
      ),
    )
    .where(
      and(
        eq(builderProjectEvents.projectId, projectId),
        gt(builderProjectEvents.sequence, afterSequence),
      ),
    )
    .orderBy(asc(builderProjectEvents.sequence))
    .limit(limit)

  return rows.map(toBuilderProjectEvent)
}

export async function getBuilderProjectState({
  projectId,
  ownerId,
  includeDeleted = false,
}: {
  projectId: string
  ownerId?: string
  includeDeleted?: boolean
}) {
  const project = await selectBuilderProjectState(projectId)
  if (!project || (project.deletedAt && !includeDeleted)) {
    throw new BuilderProjectNotFoundError()
  }
  if (ownerId && project.ownerId !== ownerId) {
    throw new BuilderProjectOwnershipError()
  }
  return project
}

export async function listBuilderProjectStates({
  ownerId,
  limit = 100,
}: {
  ownerId: string
  limit?: number
}) {
  return db
    .select({
      id: builderProjects.id,
      ownerId: builderProjects.ownerId,
      forkedFromId: builderProjects.forkedFromId,
      title: builderProjects.title,
      description: builderProjects.description,
      snapshotHash: builderProjects.snapshotHash,
      currentRevisionId: builderProjectRevisions.id,
      currentRevisionNumber: builderProjects.currentRevisionNumber,
      lastEventSequence: builderProjects.lastEventSequence,
      lastLeaseFencingToken: builderProjects.lastLeaseFencingToken,
      createdAt: builderProjects.createdAt,
      updatedAt: builderProjects.updatedAt,
      deletedAt: builderProjects.deletedAt,
      authorName: users.name,
      authorDisplayUsername: users.displayUsername,
      authorImage: users.image,
      authorOauthImage: users.oauthImage,
    })
    .from(builderProjects)
    .innerJoin(users, eq(builderProjects.ownerId, users.id))
    .innerJoin(
      builderProjectRevisions,
      and(
        eq(builderProjectRevisions.projectId, builderProjects.id),
        eq(
          builderProjectRevisions.revisionNumber,
          builderProjects.currentRevisionNumber,
        ),
      ),
    )
    .where(
      and(
        eq(builderProjects.ownerId, ownerId),
        isNull(builderProjects.deletedAt),
      ),
    )
    .orderBy(desc(builderProjects.updatedAt))
    .limit(limit)
}

export type CreateBuilderProjectStateInput = {
  id: string
  ownerId: string
  clientMutationId: string
  revisionId: string
  snapshotHash: string
  title: string
  description: string
  forkedFromId?: string
  createdAt?: Date
  updatedAt?: Date
}

function getBuilderProjectCreationRequestHash(
  input: CreateBuilderProjectStateInput,
  matchRevisionId: boolean,
) {
  return getBuilderProjectMutationRequestHash({
    type: 'project.create',
    clientMutationId: input.clientMutationId,
    id: input.id,
    ownerId: input.ownerId,
    revisionId: matchRevisionId ? input.revisionId : null,
    snapshotHash: input.snapshotHash,
    title: input.title,
    description: input.description,
    forkedFromId: input.forkedFromId ?? null,
    createdAt: input.createdAt?.toISOString() ?? null,
    updatedAt: input.updatedAt?.toISOString() ?? null,
    legacyImport: !matchRevisionId,
  })
}

function ensureBuilderProjectCreationReceipt(
  input: CreateBuilderProjectStateInput,
  requestHash: string,
) {
  return db.transaction(async (transaction) => {
    await ensureBuilderProjectMutationReceipt(transaction, {
      projectId: input.id,
      clientMutationId: input.clientMutationId,
      commandType: 'project.create',
      requestHash,
    })
  })
}

export async function preflightBuilderProjectCreation(
  input: CreateBuilderProjectStateInput,
) {
  const requestHash = await getBuilderProjectCreationRequestHash(input, true)
  const existing = await findProjectCreationByMutation(input)
  if (existing) {
    await ensureBuilderProjectCreationReceipt(input, requestHash)
    return existing
  }

  const [idConflict] = await db
    .select({ id: builderProjects.id })
    .from(builderProjects)
    .where(eq(builderProjects.id, input.id))
    .limit(1)
  if (idConflict) {
    throw new BuilderProjectConflictError(
      'Builder project conflicts with existing state',
    )
  }
  const [tombstone] = await db
    .select({ projectId: builderProjectTombstones.projectId })
    .from(builderProjectTombstones)
    .where(eq(builderProjectTombstones.projectId, input.id))
    .limit(1)
  if (tombstone) {
    throw new BuilderProjectConflictError('Builder project ID is reserved')
  }

  const existingProjects = await db
    .select({ id: builderProjects.id })
    .from(builderProjects)
    .where(
      and(
        eq(builderProjects.ownerId, input.ownerId),
        isNull(builderProjects.deletedAt),
      ),
    )
    .limit(builderProjectOwnerLimit)
  if (existingProjects.length >= builderProjectOwnerLimit) {
    throw new BuilderProjectLimitError()
  }

  return undefined
}

export function createBuilderProjectState(
  input: CreateBuilderProjectStateInput,
) {
  return createBuilderProjectStateInternal(input, false, true)
}

export function importLegacyBuilderProjectState(
  input: CreateBuilderProjectStateInput,
) {
  return createBuilderProjectStateInternal(input, true, false)
}

async function createBuilderProjectStateInternal(
  input: CreateBuilderProjectStateInput,
  bypassOwnerLimit: boolean,
  matchRevisionId: boolean,
) {
  const requestHash = await getBuilderProjectCreationRequestHash(
    input,
    matchRevisionId,
  )
  const existing = await findProjectCreationByMutation(input, matchRevisionId)
  if (existing) {
    await ensureBuilderProjectCreationReceipt(input, requestHash)
    return existing
  }

  try {
    return await db.transaction(async (transaction) => {
      const [owner] = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.ownerId))
        .for('update')
        .limit(1)
      if (!owner) throw new BuilderProjectOwnershipError()

      const [duplicate] = await transaction
        .select({ id: builderProjects.id })
        .from(builderProjects)
        .where(
          and(
            eq(builderProjects.ownerId, input.ownerId),
            eq(builderProjects.clientMutationId, input.clientMutationId),
          ),
        )
        .limit(1)
      if (duplicate) {
        const matching = await requireMatchingBuilderProjectCreation(
          input,
          duplicate.id,
          transaction,
          matchRevisionId,
        )
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: matching.id,
          clientMutationId: input.clientMutationId,
          commandType: 'project.create',
          requestHash,
        })
        return matching
      }

      const [tombstone] = await transaction
        .select({ projectId: builderProjectTombstones.projectId })
        .from(builderProjectTombstones)
        .where(eq(builderProjectTombstones.projectId, input.id))
        .limit(1)
      if (tombstone) {
        throw new BuilderProjectConflictError('Builder project ID is reserved')
      }

      const existingProjects = await transaction
        .select({ id: builderProjects.id })
        .from(builderProjects)
        .where(
          and(
            eq(builderProjects.ownerId, input.ownerId),
            isNull(builderProjects.deletedAt),
          ),
        )
        .limit(builderProjectOwnerLimit)
      if (
        !bypassOwnerLimit &&
        existingProjects.length >= builderProjectOwnerLimit
      ) {
        throw new BuilderProjectLimitError()
      }

      const now = input.updatedAt ?? input.createdAt ?? new Date()
      const [project] = await transaction
        .insert(builderProjects)
        .values({
          id: input.id,
          ownerId: input.ownerId,
          clientMutationId: input.clientMutationId,
          forkedFromId: input.forkedFromId,
          title: input.title,
          description: input.description,
          snapshotHash: input.snapshotHash,
          currentRevisionNumber: 1,
          createdAt: input.createdAt ?? now,
          updatedAt: now,
        })
        .returning()

      await ensureBuilderProjectMutationReceipt(transaction, {
        projectId: project.id,
        clientMutationId: input.clientMutationId,
        commandType: 'project.create',
        requestHash,
      })

      await transaction.insert(builderProjectUsage).values({
        projectId: input.id,
        revisions: 1,
        updatedAt: now,
      })

      const [revision] = await transaction
        .insert(builderProjectRevisions)
        .values({
          id: input.revisionId,
          projectId: input.id,
          ownerId: input.ownerId,
          clientMutationId: input.clientMutationId,
          revisionNumber: 1,
          snapshotHash: input.snapshotHash,
          createdAt: input.createdAt ?? now,
        })
        .returning()

      await appendEventInTransaction(transaction, {
        projectId: input.id,
        ownerId: input.ownerId,
        clientEventId: crypto.randomUUID(),
        clientMutationId: input.clientMutationId,
        type: 'project.created',
        payload: projectPayload(project, revision.id),
        occurredAt: now,
      })
      await appendEventInTransaction(transaction, {
        projectId: input.id,
        ownerId: input.ownerId,
        clientEventId: crypto.randomUUID(),
        clientMutationId: input.clientMutationId,
        revisionId: revision.id,
        type: 'revision.created',
        payload: revisionPayload(revision),
        occurredAt: now,
      })
      const created = await selectBuilderProjectState(input.id, transaction)
      if (!created) throw new BuilderProjectNotFoundError()
      return created
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await findProjectCreationByMutation(
        input,
        matchRevisionId,
      )
      if (duplicate) {
        await ensureBuilderProjectCreationReceipt(input, requestHash)
        return duplicate
      }
    }
    if (isBuilderProjectConstraintViolation(error)) {
      throw new BuilderProjectConflictError(
        'Builder project conflicts with existing state',
      )
    }
    throw error
  }
}

export async function updateBuilderProjectState(input: {
  projectId: string
  ownerId: string
  clientMutationId: string
  requestHash: string
  revisionId: string
  snapshotHash: string
  title?: string
  description?: string
  expectedRevisionNumber?: number
  occurredAt?: Date
}) {
  return withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        const project = await lockOwnedProject(
          transaction,
          input.projectId,
          input.ownerId,
        )
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: input.projectId,
          clientMutationId: input.clientMutationId,
          commandType: 'project.revise',
          requestHash: input.requestHash,
        })
        const [existingRevision] = await transaction
          .select()
          .from(builderProjectRevisions)
          .where(
            and(
              eq(builderProjectRevisions.projectId, input.projectId),
              eq(
                builderProjectRevisions.clientMutationId,
                input.clientMutationId,
              ),
            ),
          )
          .limit(1)
        if (existingRevision) {
          if (
            existingRevision.id !== input.revisionId ||
            existingRevision.snapshotHash !== input.snapshotHash ||
            (input.expectedRevisionNumber !== undefined &&
              existingRevision.revisionNumber !==
                input.expectedRevisionNumber + 1)
          ) {
            throw new BuilderProjectRevisionConflictError(
              'Builder project mutation conflicts with an existing revision',
            )
          }
          const existing = await selectBuilderProjectState(
            input.projectId,
            transaction,
          )
          if (!existing) throw new BuilderProjectNotFoundError()
          return existing
        }
        if (
          input.expectedRevisionNumber !== undefined &&
          project.currentRevisionNumber !== input.expectedRevisionNumber
        ) {
          throw new BuilderProjectRevisionConflictError()
        }

        const [parentRevision] = await transaction
          .select({ id: builderProjectRevisions.id })
          .from(builderProjectRevisions)
          .where(
            and(
              eq(builderProjectRevisions.projectId, input.projectId),
              eq(
                builderProjectRevisions.revisionNumber,
                project.currentRevisionNumber,
              ),
            ),
          )
          .limit(1)
        if (!parentRevision) throw new BuilderProjectConflictError()

        const now = input.occurredAt ?? new Date()
        const nextRevisionNumber = project.currentRevisionNumber + 1
        const [revision] = await transaction
          .insert(builderProjectRevisions)
          .values({
            id: input.revisionId,
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientMutationId: input.clientMutationId,
            parentRevisionId: parentRevision.id,
            revisionNumber: nextRevisionNumber,
            snapshotHash: input.snapshotHash,
            createdAt: now,
          })
          .returning()
        await incrementBuilderProjectUsageInTransaction(
          transaction,
          input.projectId,
          { revisions: 1, payloadBytes: sql<number>`0` },
        )

        const [updated] = await transaction
          .update(builderProjects)
          .set({
            snapshotHash: input.snapshotHash,
            currentRevisionNumber: nextRevisionNumber,
            title: input.title ?? project.title,
            description: input.description ?? project.description,
            updatedAt: now,
          })
          .where(eq(builderProjects.id, input.projectId))
          .returning()

        await appendEventInTransaction(transaction, {
          projectId: input.projectId,
          ownerId: input.ownerId,
          clientEventId: crypto.randomUUID(),
          clientMutationId: input.clientMutationId,
          revisionId: revision.id,
          type: 'revision.created',
          payload: revisionPayload(revision),
          occurredAt: now,
        })
        await appendEventInTransaction(transaction, {
          projectId: input.projectId,
          ownerId: input.ownerId,
          clientEventId: crypto.randomUUID(),
          clientMutationId: input.clientMutationId,
          type: 'project.updated',
          payload: projectPayload(updated, revision.id),
          occurredAt: now,
        })
        const state = await selectBuilderProjectState(
          input.projectId,
          transaction,
        )
        if (!state) throw new BuilderProjectNotFoundError()
        return state
      }),
    'Builder project revision conflicts with existing state',
  )
}

export async function deleteBuilderProjectState(input: {
  projectId: string
  ownerId: string
  clientMutationId: string
  actorId?: string
  occurredAt?: Date
}) {
  const requestHash = await getBuilderProjectMutationRequestHash({
    type: 'project.delete',
    projectId: input.projectId,
    ownerId: input.ownerId,
    clientMutationId: input.clientMutationId,
    actorId: input.actorId ?? input.ownerId,
  })
  return db.transaction(async (transaction) => {
    const project = await lockOwnedProject(
      transaction,
      input.projectId,
      input.ownerId,
      true,
    )
    await ensureBuilderProjectMutationReceipt(transaction, {
      projectId: input.projectId,
      clientMutationId: input.clientMutationId,
      commandType: 'project.delete',
      requestHash,
    })

    const now = input.occurredAt ?? new Date()
    await cancelNonterminalRunsForDeletedProjectInTransaction(
      transaction,
      project,
      now,
      input.clientMutationId,
    )
    if (project.deletedAt) return project

    const [deleted] = await transaction
      .update(builderProjects)
      .set({
        deletedAt: now,
        deletedById: input.actorId ?? input.ownerId,
        updatedAt: now,
      })
      .where(eq(builderProjects.id, input.projectId))
      .returning()
    await transaction
      .insert(builderProjectTombstones)
      .values({
        projectId: input.projectId,
        ownerId: input.ownerId,
        deletedAt: now,
      })
      .onConflictDoNothing()
    await appendEventInTransaction(transaction, {
      projectId: input.projectId,
      ownerId: input.ownerId,
      clientEventId: crypto.randomUUID(),
      clientMutationId: input.clientMutationId,
      type: 'project.deleted',
      payload: {
        projectId: input.projectId,
        deletedAt: now.toISOString(),
        actorId: input.actorId ?? input.ownerId,
      },
      occurredAt: now,
      allowQuotaOverflow: true,
    })
    return deleted
  })
}

export async function quarantineBuilderProjectsBySnapshotHash({
  snapshotHash,
  actorId,
  occurredAt = new Date(),
}: {
  snapshotHash: string
  actorId: string
  occurredAt?: Date
}) {
  return db.transaction(async (transaction) => {
    const projects = await transaction
      .select()
      .from(builderProjects)
      .where(
        and(
          or(
            eq(builderProjects.snapshotHash, snapshotHash),
            exists(
              transaction
                .select({ id: builderProjectRevisions.id })
                .from(builderProjectRevisions)
                .where(
                  and(
                    eq(builderProjectRevisions.projectId, builderProjects.id),
                    eq(builderProjectRevisions.snapshotHash, snapshotHash),
                  ),
                ),
            ),
          ),
          isNull(builderProjects.deletedAt),
        ),
      )
      .orderBy(asc(builderProjects.id))
      .for('update')

    await transaction
      .insert(builderProjectSnapshots)
      .values({
        hash: snapshotHash,
        quarantinedAt: occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      })
      .onConflictDoUpdate({
        target: builderProjectSnapshots.hash,
        set: { quarantinedAt: occurredAt, updatedAt: occurredAt },
      })

    for (const project of projects) {
      const clientMutationId = crypto.randomUUID()
      await cancelNonterminalRunsForDeletedProjectInTransaction(
        transaction,
        project,
        occurredAt,
        clientMutationId,
      )
      await transaction
        .update(builderProjects)
        .set({
          deletedAt: occurredAt,
          deletedById: actorId,
          updatedAt: occurredAt,
        })
        .where(eq(builderProjects.id, project.id))
      await transaction
        .insert(builderProjectTombstones)
        .values({
          projectId: project.id,
          ownerId: project.ownerId,
          deletedAt: occurredAt,
        })
        .onConflictDoNothing()
      await appendEventInTransaction(transaction, {
        projectId: project.id,
        ownerId: project.ownerId,
        clientEventId: crypto.randomUUID(),
        clientMutationId,
        type: 'project.deleted',
        payload: {
          projectId: project.id,
          deletedAt: occurredAt.toISOString(),
          actorId,
          reason: 'snapshot-quarantined',
          snapshotHash,
        },
        occurredAt,
        allowQuotaOverflow: true,
      })
    }

    await transaction
      .delete(builderProjectSnapshotReservations)
      .where(eq(builderProjectSnapshotReservations.snapshotHash, snapshotHash))

    return projects.map((project) => project.id)
  })
}

export async function getBuilderProjectConversationSnapshotPage({
  projectId,
  ownerId,
  continuation,
}: {
  projectId: string
  ownerId: string
  continuation?: BuilderProjectSyncSnapshotContinuation
}) {
  return db.transaction(async (transaction) => {
    let project: ReturnType<typeof syncProject> | null = null
    let pageCursor: BuilderProjectSyncSnapshotContinuation
    let headCursor: number

    if (continuation) {
      const current = await lockOwnedProject(
        transaction,
        projectId,
        ownerId,
        true,
      )
      if (continuation.cursor > current.lastEventSequence) {
        throw new BuilderProjectConflictError(
          'Builder project sync cursor is ahead of the project',
        )
      }
      pageCursor = continuation
      headCursor = current.lastEventSequence
    } else {
      await lockOwnedProject(transaction, projectId, ownerId)
      await interruptExpiredRunsInTransaction(transaction, projectId, ownerId)

      const current = await selectBuilderProjectState(projectId, transaction)
      if (!current || current.deletedAt) {
        throw new BuilderProjectNotFoundError()
      }
      project = syncProject(current)
      pageCursor = {
        version: 1,
        projectId,
        cursor: current.lastEventSequence,
        entity: 'threads',
        afterId: null,
      }
      headCursor = current.lastEventSequence
    }

    const page = await selectBuilderProjectConversationPage(
      transaction,
      pageCursor,
      project,
      headCursor,
    )

    return {
      project,
      cursor: pageCursor.cursor,
      headCursor,
      ...page,
    }
  })
}

export type BuilderProjectConversationSnapshotPage = Awaited<
  ReturnType<typeof getBuilderProjectConversationSnapshotPage>
>

async function selectBuilderProjectConversationPage(
  transaction: BuilderProjectTransaction,
  cursor: BuilderProjectSyncSnapshotContinuation,
  project: ReturnType<typeof syncProject> | null,
  headCursor: number,
) {
  if (cursor.entity === 'threads') {
    const rows = await transaction
      .select()
      .from(builderProjectThreads)
      .where(
        cursor.afterId
          ? and(
              eq(builderProjectThreads.projectId, cursor.projectId),
              gt(builderProjectThreads.id, cursor.afterId),
            )
          : eq(builderProjectThreads.projectId, cursor.projectId),
      )
      .orderBy(asc(builderProjectThreads.id))
      .limit(builderProjectSyncSnapshotPageMaxRows + 1)
    const threads = takeBuilderProjectSyncSnapshotPageRows(
      rows.map(syncThread),
      (selected) => ({
        project,
        cursor: cursor.cursor,
        headCursor,
        threads: selected,
        messages: [],
        runs: [],
        continuation: 'x'.repeat(
          builderProjectSyncSnapshotContinuationMaxCharacters,
        ),
      }),
    )
    const last = threads.at(-1)
    const continuation: BuilderProjectSyncSnapshotContinuation =
      threads.length < rows.length && last
        ? { ...cursor, afterId: last.id }
        : { ...cursor, entity: 'messages', afterId: null }
    return {
      threads,
      messages: [],
      runs: [],
      continuation,
    }
  }

  if (cursor.entity === 'messages') {
    const rows = await transaction
      .select()
      .from(builderProjectMessages)
      .where(
        cursor.afterId
          ? and(
              eq(builderProjectMessages.projectId, cursor.projectId),
              gt(builderProjectMessages.id, cursor.afterId),
            )
          : eq(builderProjectMessages.projectId, cursor.projectId),
      )
      .orderBy(asc(builderProjectMessages.id))
      .limit(builderProjectSyncSnapshotPageMaxRows + 1)
    const messages = takeBuilderProjectSyncSnapshotPageRows(
      rows.map(syncMessage),
      (selected) => ({
        project,
        cursor: cursor.cursor,
        headCursor,
        threads: [],
        messages: selected,
        runs: [],
        continuation: 'x'.repeat(
          builderProjectSyncSnapshotContinuationMaxCharacters,
        ),
      }),
    )
    const last = messages.at(-1)
    const continuation: BuilderProjectSyncSnapshotContinuation =
      messages.length < rows.length && last
        ? { ...cursor, afterId: last.id }
        : { ...cursor, entity: 'runs', afterId: null }
    return {
      threads: [],
      messages,
      runs: [],
      continuation,
    }
  }

  const rows = await transaction
    .select()
    .from(builderProjectRuns)
    .where(
      cursor.afterId
        ? and(
            eq(builderProjectRuns.projectId, cursor.projectId),
            gt(builderProjectRuns.id, cursor.afterId),
          )
        : eq(builderProjectRuns.projectId, cursor.projectId),
    )
    .orderBy(asc(builderProjectRuns.id))
    .limit(builderProjectSyncSnapshotPageMaxRows + 1)
  const runs = takeBuilderProjectSyncSnapshotPageRows(
    rows.map(syncRun),
    (selected) => ({
      project,
      cursor: cursor.cursor,
      headCursor,
      threads: [],
      messages: [],
      runs: selected,
      continuation: 'x'.repeat(
        builderProjectSyncSnapshotContinuationMaxCharacters,
      ),
    }),
  )
  const last = runs.at(-1)
  return {
    threads: [],
    messages: [],
    runs,
    continuation:
      runs.length < rows.length && last
        ? { ...cursor, afterId: last.id }
        : null,
  }
}

export async function createBuilderProjectThread(input: {
  projectId: string
  ownerId: string
  id: string
  clientMutationId: string
  requestHash: string
  title: string
  createdAt?: Date
}) {
  return withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        await lockOwnedProject(transaction, input.projectId, input.ownerId)
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: input.projectId,
          clientMutationId: input.clientMutationId,
          commandType: 'thread.create',
          requestHash: input.requestHash,
        })
        const [existing] = await transaction
          .select()
          .from(builderProjectThreads)
          .where(
            and(
              eq(builderProjectThreads.projectId, input.projectId),
              eq(
                builderProjectThreads.clientMutationId,
                input.clientMutationId,
              ),
            ),
          )
          .limit(1)
        if (existing) {
          return commandResult(
            input.clientMutationId,
            await listMutationEventsInTransaction(
              transaction,
              input.projectId,
              input.clientMutationId,
            ),
          )
        }

        const now = input.createdAt ?? new Date()
        const [thread] = await transaction
          .insert(builderProjectThreads)
          .values({
            id: input.id,
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientMutationId: input.clientMutationId,
            title: input.title,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
        await incrementBuilderProjectUsageInTransaction(
          transaction,
          input.projectId,
          {
            threads: 1,
            payloadBytes: sql<number>`octet_length(${input.title})`,
          },
        )
        const event = await appendEventInTransaction(transaction, {
          projectId: input.projectId,
          ownerId: input.ownerId,
          clientEventId: crypto.randomUUID(),
          clientMutationId: input.clientMutationId,
          threadId: thread.id,
          type: 'thread.created',
          payload: { thread: syncThread(thread) },
          occurredAt: now,
        })
        return commandResult(input.clientMutationId, [event])
      }),
    'Builder thread conflicts with existing state',
  )
}

export async function enqueueBuilderProjectRun(input: {
  projectId: string
  ownerId: string
  runId: string
  threadId: string
  clientMutationId: string
  requestHash: string
  queueKind: 'queue' | 'steer'
  provider: string
  model: string
  occurredAt?: Date
  userMessage: {
    id: string
    clientMutationId: string
    content: string
    parts: Array<BuilderJsonObject>
  }
}) {
  return withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        await lockOwnedProject(transaction, input.projectId, input.ownerId)
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: input.projectId,
          clientMutationId: input.clientMutationId,
          commandType: 'run.enqueue',
          requestHash: input.requestHash,
        })
        const [existing] = await transaction
          .select()
          .from(builderProjectRuns)
          .where(
            and(
              eq(builderProjectRuns.projectId, input.projectId),
              eq(builderProjectRuns.clientMutationId, input.clientMutationId),
            ),
          )
          .limit(1)
        if (existing) {
          return commandResult(
            input.clientMutationId,
            await listMutationEventsInTransaction(
              transaction,
              input.projectId,
              input.clientMutationId,
            ),
          )
        }

        const [thread] = await transaction
          .select()
          .from(builderProjectThreads)
          .where(
            and(
              eq(builderProjectThreads.projectId, input.projectId),
              eq(builderProjectThreads.id, input.threadId),
              isNull(builderProjectThreads.archivedAt),
            ),
          )
          .for('update')
          .limit(1)
        if (!thread) {
          throw new BuilderProjectConflictError('Builder thread not found')
        }

        const now = input.occurredAt ?? new Date()
        const firstMessageTitle =
          thread.lastMessagePosition === 0
            ? getBuilderThreadTitle(input.userMessage.content)
            : undefined
        const [updatedThread] = await transaction
          .update(builderProjectThreads)
          .set({
            lastMessagePosition: sql`${builderProjectThreads.lastMessagePosition} + 1`,
            ...(firstMessageTitle ? { title: firstMessageTitle } : {}),
            updatedAt: now,
          })
          .where(eq(builderProjectThreads.id, input.threadId))
          .returning()
        const [run] = await transaction
          .insert(builderProjectRuns)
          .values({
            id: input.runId,
            projectId: input.projectId,
            ownerId: input.ownerId,
            threadId: input.threadId,
            clientMutationId: input.clientMutationId,
            status: 'pending',
            queueKind: input.queueKind,
            provider: input.provider,
            model: input.model,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
        const [message] = await transaction
          .insert(builderProjectMessages)
          .values({
            id: input.userMessage.id,
            projectId: input.projectId,
            ownerId: input.ownerId,
            threadId: input.threadId,
            runId: input.runId,
            clientMutationId: input.userMessage.clientMutationId,
            position: updatedThread.lastMessagePosition,
            role: 'user',
            content: input.userMessage.content,
            parts: input.userMessage.parts,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
        await incrementBuilderProjectUsageInTransaction(
          transaction,
          input.projectId,
          {
            messages: 1,
            runs: 1,
            payloadBytes: sql<number>`
              octet_length(${input.provider})
              + octet_length(${input.model})
              + octet_length(${input.userMessage.content})
              + pg_column_size(${JSON.stringify(input.userMessage.parts)}::jsonb)
              + octet_length(${updatedThread.title})
              - octet_length(${thread.title})
            `,
          },
        )

        const events = [
          await appendEventInTransaction(transaction, {
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientEventId: crypto.randomUUID(),
            clientMutationId: input.clientMutationId,
            threadId: input.threadId,
            type: 'thread.updated',
            payload: { thread: syncThread(updatedThread) },
            occurredAt: now,
          }),
          await appendEventInTransaction(transaction, {
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientEventId: crypto.randomUUID(),
            clientMutationId: input.clientMutationId,
            threadId: input.threadId,
            messageId: message.id,
            runId: run.id,
            type: 'message.created',
            payload: { message: syncMessage(message) },
            occurredAt: now,
          }),
          await appendEventInTransaction(transaction, {
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientEventId: crypto.randomUUID(),
            clientMutationId: input.clientMutationId,
            threadId: input.threadId,
            runId: run.id,
            type: 'run.created',
            payload: { run: syncRun(run) },
            occurredAt: now,
          }),
        ]
        return commandResult(input.clientMutationId, events)
      }),
    'Builder run conflicts with existing project state',
  )
}

export async function claimBuilderProjectRun(input: {
  projectId: string
  ownerId: string
  runId: string
  clientMutationId: string
  requestHash: string
  leaseOwnerId: string
  leaseDurationMs?: number
  occurredAt?: Date
}) {
  const leaseDurationMs = getLeaseDuration(input.leaseDurationMs)
  const result = await db.transaction(async (transaction) => {
    const project = await lockOwnedProject(
      transaction,
      input.projectId,
      input.ownerId,
    )
    const insertedReceipt = await ensureBuilderProjectMutationReceipt(
      transaction,
      {
        projectId: input.projectId,
        clientMutationId: input.clientMutationId,
        commandType: 'run.claim',
        requestHash: input.requestHash,
      },
    )
    const existingEvents = await listMutationEventsInTransaction(
      transaction,
      input.projectId,
      input.clientMutationId,
    )
    if (!insertedReceipt && existingEvents.length > 0) {
      const [run] = await transaction
        .select({ leaseFencingToken: builderProjectRuns.leaseFencingToken })
        .from(builderProjectRuns)
        .where(
          and(
            eq(builderProjectRuns.projectId, input.projectId),
            eq(builderProjectRuns.id, input.runId),
          ),
        )
        .limit(1)
      if (!run) throw new BuilderProjectLeaseError()
      return commandResult(
        input.clientMutationId,
        existingEvents,
        run.leaseFencingToken,
      )
    }

    const now = input.occurredAt ?? new Date()
    await interruptExpiredRunsInTransaction(
      transaction,
      input.projectId,
      input.ownerId,
      now,
    )
    const [activeRun] = await transaction
      .select({ id: builderProjectRuns.id })
      .from(builderProjectRuns)
      .where(
        and(
          eq(builderProjectRuns.projectId, input.projectId),
          eq(builderProjectRuns.status, 'running'),
        ),
      )
      .limit(1)
    if (activeRun) throw new BuilderProjectLeaseError('Another run is active')

    const [nextPendingRun] = await getNextBuilderProjectPendingRunQuery({
      projectId: input.projectId,
      database: transaction,
    })
    if (!nextPendingRun || nextPendingRun.id !== input.runId) {
      throw new BuilderProjectLeaseError('Builder run is not next in the queue')
    }

    const [currentRevision] = await transaction
      .select({ id: builderProjectRevisions.id })
      .from(builderProjectRevisions)
      .where(
        and(
          eq(builderProjectRevisions.projectId, input.projectId),
          eq(
            builderProjectRevisions.revisionNumber,
            project.currentRevisionNumber,
          ),
        ),
      )
      .limit(1)
    if (!currentRevision) throw new BuilderProjectConflictError()

    const [fence] = await transaction
      .update(builderProjects)
      .set({
        lastLeaseFencingToken: sql`${builderProjects.lastLeaseFencingToken} + 1`,
      })
      .where(eq(builderProjects.id, input.projectId))
      .returning({ token: builderProjects.lastLeaseFencingToken })
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs)
    const [run] = await transaction
      .update(builderProjectRuns)
      .set({
        status: 'running',
        baseRevisionId: currentRevision.id,
        leaseOwnerId: input.leaseOwnerId,
        leaseFencingToken: fence.token,
        leaseExpiresAt,
        lastHeartbeatAt: now,
        startedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(builderProjectRuns.projectId, input.projectId),
          eq(builderProjectRuns.id, input.runId),
          eq(builderProjectRuns.status, 'pending'),
        ),
      )
      .returning()
    if (!run) throw new BuilderProjectLeaseError()
    const event = await appendEventInTransaction(transaction, {
      projectId: input.projectId,
      ownerId: input.ownerId,
      clientEventId: crypto.randomUUID(),
      clientMutationId: input.clientMutationId,
      browserSessionId: input.leaseOwnerId,
      threadId: run.threadId,
      runId: run.id,
      type: 'run.started',
      payload: { run: syncRun(run) },
      occurredAt: now,
    })
    return commandResult(input.clientMutationId, [event], fence.token)
  })
  return result
}

export function getNextBuilderProjectPendingRunQuery({
  projectId,
  database = db,
}: {
  projectId: string
  database?: Pick<typeof db, 'select'>
}) {
  return database
    .select({ id: builderProjectRuns.id })
    .from(builderProjectRuns)
    .where(
      and(
        eq(builderProjectRuns.projectId, projectId),
        eq(builderProjectRuns.status, 'pending'),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${builderProjectRuns.queueKind} = 'steer' THEN 0 ELSE 1 END`,
      asc(builderProjectRuns.createdAt),
      asc(builderProjectRuns.id),
    )
    .for('update')
    .limit(1)
}

export async function cancelPendingBuilderProjectRun(input: {
  projectId: string
  ownerId: string
  runId: string
  clientMutationId: string
  requestHash: string
  browserSessionId: string
  occurredAt?: Date
}) {
  return db.transaction(async (transaction) => {
    await lockOwnedProject(transaction, input.projectId, input.ownerId)
    const insertedReceipt = await ensureBuilderProjectMutationReceipt(
      transaction,
      {
        projectId: input.projectId,
        clientMutationId: input.clientMutationId,
        commandType: 'run.cancel',
        requestHash: input.requestHash,
      },
    )
    const existingEvents = await listMutationEventsInTransaction(
      transaction,
      input.projectId,
      input.clientMutationId,
    )
    if (!insertedReceipt && existingEvents.length > 0) {
      return commandResult(input.clientMutationId, existingEvents)
    }

    const now = input.occurredAt ?? new Date()
    const [run] = await transaction
      .update(builderProjectRuns)
      .set({
        status: 'cancelled',
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(builderProjectRuns.projectId, input.projectId),
          eq(builderProjectRuns.id, input.runId),
          eq(builderProjectRuns.status, 'pending'),
        ),
      )
      .returning()
    if (!run) throw new BuilderProjectLeaseError('Builder run is not pending')
    const event = await appendEventInTransaction(transaction, {
      projectId: input.projectId,
      ownerId: input.ownerId,
      clientEventId: crypto.randomUUID(),
      clientMutationId: input.clientMutationId,
      browserSessionId: input.browserSessionId,
      threadId: run.threadId,
      runId: run.id,
      type: 'run.cancelled',
      payload: { run: syncRun(run), reason: 'prompt-cancelled' },
      occurredAt: now,
      allowQuotaOverflow: true,
    })
    return commandResult(input.clientMutationId, [event])
  })
}

export async function renewBuilderProjectRunLease(input: {
  projectId: string
  ownerId: string
  runId: string
  leaseOwnerId: string
  fencingToken: number
  clientMutationId: string
  leaseDurationMs?: number
  occurredAt?: Date
}) {
  const leaseDurationMs = getLeaseDuration(input.leaseDurationMs)
  const result = await db.transaction(async (transaction) => {
    await lockOwnedProject(transaction, input.projectId, input.ownerId)
    const now = input.occurredAt ?? new Date()
    const expired = await interruptExpiredRunsInTransaction(
      transaction,
      input.projectId,
      input.ownerId,
      now,
    )
    if (expired.some((run) => run.id === input.runId)) return undefined

    const [run] = await transaction
      .update(builderProjectRuns)
      .set({
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        lastHeartbeatAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(builderProjectRuns.projectId, input.projectId),
          eq(builderProjectRuns.id, input.runId),
          eq(builderProjectRuns.status, 'running'),
          eq(builderProjectRuns.leaseOwnerId, input.leaseOwnerId),
          eq(builderProjectRuns.leaseFencingToken, input.fencingToken),
        ),
      )
      .returning()
    if (!run) return undefined
    const [project] = await transaction
      .select({ sequence: builderProjects.lastEventSequence })
      .from(builderProjects)
      .where(eq(builderProjects.id, input.projectId))
      .limit(1)
    return { run, sequence: project.sequence }
  })
  if (!result) throw new BuilderProjectLeaseError()
  return commandResult(
    input.clientMutationId,
    [],
    result.run.leaseFencingToken,
    result.sequence,
  )
}

export const heartbeatBuilderProjectRun = renewBuilderProjectRunLease

export async function finishBuilderProjectRun(input: {
  projectId: string
  ownerId: string
  runId: string
  clientMutationId: string
  requestHash: string
  status: 'interrupted' | 'completed' | 'failed' | 'cancelled'
  leaseOwnerId: string
  fencingToken: number
  revision?: {
    id: string
    clientMutationId: string
    snapshotHash: string
    title: string
    description: string
    expectedRevisionNumber: number
  }
  error?: BuilderJsonObject
  activity?: BuilderJsonObject
  revisionConflictFallback?: {
    clientMutationId: string
    error: BuilderJsonObject
  }
  occurredAt?: Date
  assistantMessage?: {
    id: string
    clientMutationId: string
    content: string
    parts: Array<BuilderJsonObject>
    createdAt?: Date
  }
}) {
  const result = await withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        const project = await lockOwnedProject(
          transaction,
          input.projectId,
          input.ownerId,
        )
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: input.projectId,
          clientMutationId: input.clientMutationId,
          commandType: 'run.finish',
          requestHash: input.requestHash,
        })
        if (input.revisionConflictFallback) {
          await ensureBuilderProjectMutationReceipt(transaction, {
            projectId: input.projectId,
            clientMutationId: input.revisionConflictFallback.clientMutationId,
            commandType: 'run.finish.fallback',
            requestHash: input.requestHash,
          })
        }
        const existingEvents = await listMutationEventsInTransaction(
          transaction,
          input.projectId,
          input.clientMutationId,
        )
        if (existingEvents.length > 0) {
          return {
            ...commandResult(input.clientMutationId, existingEvents),
            revisionConflict: false,
          }
        }
        if (input.revisionConflictFallback) {
          const fallbackEvents = await listMutationEventsInTransaction(
            transaction,
            input.projectId,
            input.revisionConflictFallback.clientMutationId,
          )
          if (fallbackEvents.length > 0) {
            return {
              ...commandResult(
                input.revisionConflictFallback.clientMutationId,
                fallbackEvents,
              ),
              revisionConflict: true,
            }
          }
        }

        const now = input.occurredAt ?? new Date()
        await interruptExpiredRunsInTransaction(
          transaction,
          input.projectId,
          input.ownerId,
          now,
        )

        const [current] = await transaction
          .select()
          .from(builderProjectRuns)
          .where(
            and(
              eq(builderProjectRuns.projectId, input.projectId),
              eq(builderProjectRuns.id, input.runId),
            ),
          )
          .for('update')
          .limit(1)
        if (!current || current.leaseFencingToken !== input.fencingToken) {
          return undefined
        }

        const ownsActiveLease =
          current.status === 'running' &&
          current.leaseOwnerId === input.leaseOwnerId
        let ownsLatestExpiredLease = false
        if (
          current.status === 'interrupted' &&
          project.lastLeaseFencingToken === input.fencingToken
        ) {
          const [interruption] = await transaction
            .select({
              browserSessionId: builderProjectEvents.browserSessionId,
              payload: builderProjectEvents.payload,
            })
            .from(builderProjectEvents)
            .where(
              and(
                eq(builderProjectEvents.projectId, input.projectId),
                eq(builderProjectEvents.runId, input.runId),
                eq(builderProjectEvents.type, 'run.interrupted'),
              ),
            )
            .orderBy(desc(builderProjectEvents.sequence))
            .limit(1)
          ownsLatestExpiredLease =
            interruption?.browserSessionId === input.leaseOwnerId &&
            interruption.payload.reason === 'lease-expired'
        }
        if (!ownsActiveLease && !ownsLatestExpiredLease) return undefined

        const events: Array<BuilderProjectEvent> = []
        let resultRevisionId: string | undefined
        let terminalClientMutationId = input.clientMutationId
        let terminalStatus = input.status
        let terminalError = input.error
        let terminalActivity = input.activity
        let revisionConflict = false
        if (input.status === 'completed' && input.revision) {
          if (
            project.currentRevisionNumber !==
            input.revision.expectedRevisionNumber
          ) {
            if (!input.revisionConflictFallback) {
              throw new BuilderProjectRevisionConflictError()
            }
            terminalClientMutationId =
              input.revisionConflictFallback.clientMutationId
            terminalStatus = 'failed'
            terminalError = input.revisionConflictFallback.error
            terminalActivity = undefined
            revisionConflict = true
          } else {
            await assertBuilderProjectSnapshotAvailable(
              input.revision.snapshotHash,
              transaction,
            )
            const [parentRevision] = await transaction
              .select({ id: builderProjectRevisions.id })
              .from(builderProjectRevisions)
              .where(
                and(
                  eq(builderProjectRevisions.projectId, input.projectId),
                  eq(
                    builderProjectRevisions.revisionNumber,
                    project.currentRevisionNumber,
                  ),
                ),
              )
              .limit(1)
            if (!parentRevision) throw new BuilderProjectConflictError()

            const nextRevisionNumber = project.currentRevisionNumber + 1
            const [revision] = await transaction
              .insert(builderProjectRevisions)
              .values({
                id: input.revision.id,
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientMutationId: input.revision.clientMutationId,
                parentRevisionId: parentRevision.id,
                revisionNumber: nextRevisionNumber,
                snapshotHash: input.revision.snapshotHash,
                createdAt: now,
              })
              .returning()
            await incrementBuilderProjectUsageInTransaction(
              transaction,
              input.projectId,
              { revisions: 1, payloadBytes: sql<number>`0` },
              false,
            )
            const [updatedProject] = await transaction
              .update(builderProjects)
              .set({
                snapshotHash: input.revision.snapshotHash,
                currentRevisionNumber: nextRevisionNumber,
                title: input.revision.title,
                description: input.revision.description,
                updatedAt: now,
              })
              .where(eq(builderProjects.id, input.projectId))
              .returning()
            resultRevisionId = revision.id
            events.push(
              await appendEventInTransaction(transaction, {
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientEventId: crypto.randomUUID(),
                clientMutationId: terminalClientMutationId,
                browserSessionId: input.leaseOwnerId,
                revisionId: revision.id,
                type: 'revision.created',
                payload: revisionPayload(revision),
                occurredAt: now,
                allowQuotaOverflow: true,
              }),
              await appendEventInTransaction(transaction, {
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientEventId: crypto.randomUUID(),
                clientMutationId: terminalClientMutationId,
                browserSessionId: input.leaseOwnerId,
                type: 'project.updated',
                payload: projectPayload(updatedProject, revision.id),
                occurredAt: now,
                allowQuotaOverflow: true,
              }),
            )
          }
        } else if (input.revision) {
          throw new BuilderProjectConflictError(
            'Only completed Builder runs may create a project revision',
          )
        }

        const [run] = await transaction
          .update(builderProjectRuns)
          .set({
            status: terminalStatus,
            resultRevisionId,
            leaseOwnerId: null,
            leaseExpiresAt: null,
            lastHeartbeatAt: now,
            error: terminalError,
            activity: terminalActivity,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(builderProjectRuns.id, input.runId))
          .returning()
        await incrementBuilderProjectUsageInTransaction(
          transaction,
          input.projectId,
          {
            payloadBytes: sql<number>`
              ${getJsonbPayloadBytes(terminalError)}
              + ${getJsonbPayloadBytes(terminalActivity)}
              - ${getJsonbPayloadBytes(current.error ?? undefined)}
              - ${getJsonbPayloadBytes(current.activity ?? undefined)}
            `,
          },
          false,
        )

        if (input.assistantMessage) {
          const [updatedThread] = await transaction
            .update(builderProjectThreads)
            .set({
              lastMessagePosition: sql`${builderProjectThreads.lastMessagePosition} + 1`,
              updatedAt: now,
            })
            .where(eq(builderProjectThreads.id, run.threadId))
            .returning()
          const [message] = await transaction
            .insert(builderProjectMessages)
            .values({
              id: input.assistantMessage.id,
              projectId: input.projectId,
              ownerId: input.ownerId,
              threadId: run.threadId,
              runId: run.id,
              clientMutationId: input.assistantMessage.clientMutationId,
              position: updatedThread.lastMessagePosition,
              role: 'assistant',
              content: input.assistantMessage.content,
              parts: input.assistantMessage.parts,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
          await incrementBuilderProjectUsageInTransaction(
            transaction,
            input.projectId,
            {
              messages: 1,
              payloadBytes: sql<number>`
                octet_length(${input.assistantMessage.content})
                + pg_column_size(${JSON.stringify(input.assistantMessage.parts)}::jsonb)
              `,
            },
            false,
          )
          events.push(
            await appendEventInTransaction(transaction, {
              projectId: input.projectId,
              ownerId: input.ownerId,
              clientEventId: crypto.randomUUID(),
              clientMutationId: terminalClientMutationId,
              browserSessionId: input.leaseOwnerId,
              threadId: run.threadId,
              type: 'thread.updated',
              payload: { thread: syncThread(updatedThread) },
              occurredAt: now,
              allowQuotaOverflow: true,
            }),
            await appendEventInTransaction(transaction, {
              projectId: input.projectId,
              ownerId: input.ownerId,
              clientEventId: crypto.randomUUID(),
              clientMutationId: terminalClientMutationId,
              browserSessionId: input.leaseOwnerId,
              threadId: run.threadId,
              messageId: message.id,
              runId: run.id,
              type: 'message.created',
              payload: { message: syncMessage(message) },
              occurredAt: now,
              allowQuotaOverflow: true,
            }),
          )
        }
        events.push(
          await appendEventInTransaction(transaction, {
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientEventId: crypto.randomUUID(),
            clientMutationId: terminalClientMutationId,
            browserSessionId: input.leaseOwnerId,
            threadId: run.threadId,
            runId: run.id,
            revisionId: resultRevisionId,
            type: terminalEventType(terminalStatus),
            payload: { run: syncRun(run) },
            occurredAt: now,
            allowQuotaOverflow: true,
          }),
        )
        return {
          ...commandResult(
            terminalClientMutationId,
            events,
            run.leaseFencingToken,
          ),
          revisionConflict,
        }
      }),
    'Builder run completion conflicts with existing project state',
  )
  if (!result) throw new BuilderProjectLeaseError()
  return result
}

export async function interruptExpiredBuilderProjectRuns({
  projectId,
  ownerId,
  occurredAt,
  includeDeleted = false,
}: {
  projectId: string
  ownerId: string
  occurredAt?: Date
  includeDeleted?: boolean
}) {
  return db.transaction(async (transaction) => {
    const project = await lockOwnedProject(
      transaction,
      projectId,
      ownerId,
      includeDeleted,
    )
    if (project.deletedAt) {
      return cancelNonterminalRunsForDeletedProjectInTransaction(
        transaction,
        project,
        occurredAt ?? new Date(),
        crypto.randomUUID(),
      )
    }
    return interruptExpiredRunsInTransaction(
      transaction,
      projectId,
      ownerId,
      occurredAt,
    )
  })
}

export async function interruptExpiredBuilderProjectRunLeases({
  occurredAt = new Date(),
  limit = 100,
}: {
  occurredAt?: Date
  limit?: number
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('Invalid Builder run lease sweep limit')
  }

  const candidates = await db
    .select({
      projectId: builderProjectRuns.projectId,
      ownerId: builderProjectRuns.ownerId,
    })
    .from(builderProjectRuns)
    .where(
      and(
        eq(builderProjectRuns.status, 'running'),
        lte(builderProjectRuns.leaseExpiresAt, occurredAt),
      ),
    )
    .orderBy(asc(builderProjectRuns.leaseExpiresAt))
    .limit(limit)

  const projects = new Map<string, string>()
  for (const candidate of candidates) {
    projects.set(candidate.projectId, candidate.ownerId)
  }

  let interruptedRunCount = 0
  for (const [projectId, ownerId] of projects) {
    try {
      const interrupted = await db.transaction(async (transaction) => {
        const project = await lockOwnedProject(
          transaction,
          projectId,
          ownerId,
          true,
        )
        if (project.deletedAt) {
          return cancelNonterminalRunsForDeletedProjectInTransaction(
            transaction,
            project,
            occurredAt,
            crypto.randomUUID(),
          )
        }
        return interruptExpiredRunsInTransaction(
          transaction,
          projectId,
          ownerId,
          occurredAt,
        )
      })
      interruptedRunCount += interrupted.length
    } catch (error) {
      if (!(error instanceof BuilderProjectNotFoundError)) throw error
    }
  }
  return interruptedRunCount
}

export async function pruneDeletedBuilderProjects({
  occurredAt = new Date(),
  limit = 25,
}: {
  occurredAt?: Date
  limit?: number
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid deleted Builder project prune limit')
  }
  const cutoff = new Date(occurredAt.getTime() - 30 * 24 * 60 * 60 * 1_000)
  const candidates = await db
    .select({
      projectId: builderProjects.id,
      ownerId: builderProjects.ownerId,
    })
    .from(builderProjects)
    .where(lte(builderProjects.deletedAt, cutoff))
    .orderBy(asc(builderProjects.deletedAt))
    .limit(limit)

  let pruned = 0
  for (const candidate of candidates) {
    pruned += await db.transaction(async (transaction) => {
      const project = await lockOwnedProject(
        transaction,
        candidate.projectId,
        candidate.ownerId,
        true,
      )
      if (!project.deletedAt || project.deletedAt > cutoff) return 0
      await transaction
        .insert(builderProjectTombstones)
        .values({
          projectId: project.id,
          ownerId: project.ownerId,
          deletedAt: project.deletedAt,
        })
        .onConflictDoNothing()
      const removed = await transaction
        .delete(builderProjects)
        .where(eq(builderProjects.id, project.id))
        .returning({ id: builderProjects.id })
      return removed.length
    })
  }
  return pruned
}

export async function importBuilderProjectConversation(input: {
  projectId: string
  ownerId: string
  clientMutationId: string
  requestHash: string
  threads: Array<{
    id: string
    title: string
    createdAt: Date
    updatedAt: Date
    archivedAt?: Date | null
  }>
  messages: Array<{
    id: string
    threadId: string
    runId?: string
    role: 'user' | 'assistant'
    content: string
    parts: Array<BuilderJsonObject>
    position: number
    createdAt: Date
    updatedAt: Date
  }>
  runs: Array<{
    id: string
    threadId: string
    status: 'interrupted' | 'completed' | 'failed' | 'cancelled'
    provider: string
    model: string
    error?: BuilderJsonObject
    activity?: BuilderJsonObject
    startedAt?: Date
    completedAt: Date
  }>
}) {
  if (
    input.threads.length > 50 ||
    input.messages.length > 1_000 ||
    input.runs.length > 500
  ) {
    throw new Error('Builder project transcript import is too large')
  }

  return withBuilderProjectConstraintErrors(
    () =>
      db.transaction(async (transaction) => {
        await lockOwnedProject(transaction, input.projectId, input.ownerId)
        await ensureBuilderProjectMutationReceipt(transaction, {
          projectId: input.projectId,
          clientMutationId: input.clientMutationId,
          commandType: 'transcript.import',
          requestHash: input.requestHash,
        })
        const existingEvents = await listMutationEventsInTransaction(
          transaction,
          input.projectId,
          input.clientMutationId,
        )
        if (existingEvents.length > 0) {
          return commandResult(input.clientMutationId, existingEvents)
        }

        const events: Array<BuilderProjectEvent> = []
        for (const threadInput of input.threads) {
          const lastMessagePosition = input.messages
            .filter((message) => message.threadId === threadInput.id)
            .reduce(
              (highest, message) => Math.max(highest, message.position),
              0,
            )
          const [insertedThread] = await transaction
            .insert(builderProjectThreads)
            .values({
              id: threadInput.id,
              projectId: input.projectId,
              ownerId: input.ownerId,
              clientMutationId: crypto.randomUUID(),
              title: threadInput.title,
              lastMessagePosition,
              createdAt: threadInput.createdAt,
              updatedAt: threadInput.updatedAt,
              archivedAt: threadInput.archivedAt,
            })
            .onConflictDoNothing()
            .returning()
          const [existingThread] = insertedThread
            ? [insertedThread]
            : await transaction
                .select()
                .from(builderProjectThreads)
                .where(
                  and(
                    eq(builderProjectThreads.projectId, input.projectId),
                    eq(builderProjectThreads.id, threadInput.id),
                  ),
                )
                .limit(1)
          if (
            !existingThread ||
            existingThread.projectId !== input.projectId ||
            existingThread.ownerId !== input.ownerId ||
            existingThread.title !== threadInput.title ||
            !datesMatch(existingThread.createdAt, threadInput.createdAt) ||
            !datesMatch(existingThread.updatedAt, threadInput.updatedAt) ||
            !datesMatch(
              existingThread.archivedAt,
              threadInput.archivedAt ?? null,
            )
          ) {
            throw new BuilderProjectConflictError(
              'Imported thread conflicts with existing project state',
            )
          }

          if (insertedThread) {
            events.push(
              await appendEventInTransaction(transaction, {
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientEventId: crypto.randomUUID(),
                clientMutationId: input.clientMutationId,
                threadId: insertedThread.id,
                type: 'thread.created',
                payload: { thread: syncThread(insertedThread) },
                occurredAt: insertedThread.createdAt,
                skipUsage: true,
              }),
            )
          } else if (lastMessagePosition > existingThread.lastMessagePosition) {
            const [updatedThread] = await transaction
              .update(builderProjectThreads)
              .set({ lastMessagePosition })
              .where(
                and(
                  eq(builderProjectThreads.projectId, input.projectId),
                  eq(builderProjectThreads.id, threadInput.id),
                ),
              )
              .returning()
            if (!updatedThread) throw new BuilderProjectNotFoundError()
            events.push(
              await appendEventInTransaction(transaction, {
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientEventId: crypto.randomUUID(),
                clientMutationId: input.clientMutationId,
                threadId: updatedThread.id,
                type: 'thread.updated',
                payload: { thread: syncThread(updatedThread) },
                skipUsage: true,
              }),
            )
          }
        }

        for (const runInput of input.runs) {
          const [insertedRun] = await transaction
            .insert(builderProjectRuns)
            .values({
              id: runInput.id,
              projectId: input.projectId,
              ownerId: input.ownerId,
              threadId: runInput.threadId,
              clientMutationId: crypto.randomUUID(),
              status: runInput.status,
              provider: runInput.provider,
              model: runInput.model,
              error: runInput.error,
              activity: runInput.activity,
              startedAt: runInput.startedAt,
              completedAt: runInput.completedAt,
              createdAt: runInput.startedAt ?? runInput.completedAt,
              updatedAt: runInput.completedAt,
            })
            .onConflictDoNothing()
            .returning()
          const [existingRun] = insertedRun
            ? [insertedRun]
            : await transaction
                .select()
                .from(builderProjectRuns)
                .where(
                  and(
                    eq(builderProjectRuns.projectId, input.projectId),
                    eq(builderProjectRuns.id, runInput.id),
                  ),
                )
                .limit(1)
          if (
            !existingRun ||
            existingRun.projectId !== input.projectId ||
            existingRun.ownerId !== input.ownerId ||
            existingRun.threadId !== runInput.threadId ||
            existingRun.status !== runInput.status ||
            existingRun.provider !== runInput.provider ||
            existingRun.model !== runInput.model ||
            !builderJsonValuesMatch(
              existingRun.error,
              runInput.error ?? null,
            ) ||
            !builderJsonValuesMatch(
              existingRun.activity,
              runInput.activity ?? null,
            ) ||
            !datesMatch(existingRun.startedAt, runInput.startedAt ?? null) ||
            !datesMatch(existingRun.completedAt, runInput.completedAt) ||
            !datesMatch(
              existingRun.createdAt,
              runInput.startedAt ?? runInput.completedAt,
            ) ||
            !datesMatch(existingRun.updatedAt, runInput.completedAt)
          ) {
            throw new BuilderProjectConflictError(
              'Imported run conflicts with existing project state',
            )
          }
          if (insertedRun) {
            events.push(
              await appendEventInTransaction(transaction, {
                projectId: input.projectId,
                ownerId: input.ownerId,
                clientEventId: crypto.randomUUID(),
                clientMutationId: input.clientMutationId,
                threadId: insertedRun.threadId,
                runId: insertedRun.id,
                type: terminalEventType(insertedRun.status),
                payload: { run: syncRun(insertedRun) },
                occurredAt: insertedRun.completedAt ?? insertedRun.updatedAt,
                skipUsage: true,
              }),
            )
          }
        }

        for (const messageInput of input.messages) {
          const [insertedMessage] = await transaction
            .insert(builderProjectMessages)
            .values({
              id: messageInput.id,
              projectId: input.projectId,
              ownerId: input.ownerId,
              threadId: messageInput.threadId,
              runId: messageInput.runId,
              clientMutationId: crypto.randomUUID(),
              role: messageInput.role,
              content: messageInput.content,
              parts: messageInput.parts,
              position: messageInput.position,
              createdAt: messageInput.createdAt,
              updatedAt: messageInput.updatedAt,
            })
            .onConflictDoNothing()
            .returning()
          if (!insertedMessage) {
            const [existingMessage] = await transaction
              .select()
              .from(builderProjectMessages)
              .where(
                and(
                  eq(builderProjectMessages.projectId, input.projectId),
                  eq(builderProjectMessages.id, messageInput.id),
                ),
              )
              .limit(1)
            if (
              !existingMessage ||
              existingMessage.projectId !== input.projectId ||
              existingMessage.ownerId !== input.ownerId ||
              existingMessage.threadId !== messageInput.threadId ||
              existingMessage.runId !== (messageInput.runId ?? null) ||
              existingMessage.position !== messageInput.position ||
              existingMessage.role !== messageInput.role ||
              existingMessage.content !== messageInput.content ||
              !builderJsonValuesMatch(
                existingMessage.parts,
                messageInput.parts,
              ) ||
              !datesMatch(existingMessage.createdAt, messageInput.createdAt) ||
              !datesMatch(existingMessage.updatedAt, messageInput.updatedAt)
            ) {
              throw new BuilderProjectConflictError(
                'Imported message conflicts with existing project state',
              )
            }
            continue
          }
          events.push(
            await appendEventInTransaction(transaction, {
              projectId: input.projectId,
              ownerId: input.ownerId,
              clientEventId: crypto.randomUUID(),
              clientMutationId: input.clientMutationId,
              threadId: insertedMessage.threadId,
              runId: insertedMessage.runId ?? undefined,
              messageId: insertedMessage.id,
              type: 'message.created',
              payload: { message: syncMessage(insertedMessage) },
              occurredAt: insertedMessage.createdAt,
              skipUsage: true,
            }),
          )
        }

        const projectState = await selectBuilderProjectState(
          input.projectId,
          transaction,
        )
        if (!projectState) throw new BuilderProjectNotFoundError()
        events.push(
          await appendEventInTransaction(transaction, {
            projectId: input.projectId,
            ownerId: input.ownerId,
            clientEventId: crypto.randomUUID(),
            clientMutationId: input.clientMutationId,
            type: 'project.updated',
            payload: {
              project: syncProject(projectState),
              importedConversation: true,
            },
            skipUsage: true,
          }),
        )
        await rebuildBuilderProjectUsageInTransaction(
          transaction,
          input.projectId,
        )
        return commandResult(input.clientMutationId, events)
      }),
    'Builder conversation conflicts with existing project state',
  )
}

export const importBuilderProjectTranscript = importBuilderProjectConversation

function datesMatch(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime()
}

function builderJsonValuesMatch(
  left: BuilderJsonValue | undefined,
  right: BuilderJsonValue | undefined,
): boolean {
  if (left === right) return true
  if (Array.isArray(left)) {
    return (
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => builderJsonValuesMatch(value, right[index]))
    )
  }
  if (Array.isArray(right)) return false
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        builderJsonValuesMatch(left[key], right[key]),
    )
  )
}

function canonicalBuilderMutationJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Builder mutation payload must contain finite numbers')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalBuilderMutationJson).join(',')}]`
  }
  if (typeof value !== 'object') {
    throw new Error('Builder mutation payload must be JSON')
  }

  const record = Object.fromEntries(Object.entries(value))
  const entries = Object.keys(record)
    .sort()
    .map((key) => {
      const child = record[key]
      if (child === undefined) {
        throw new Error('Builder mutation payload must not contain undefined')
      }
      return `${JSON.stringify(key)}:${canonicalBuilderMutationJson(child)}`
    })
  return `{${entries.join(',')}}`
}

async function ensureBuilderProjectMutationReceipt(
  transaction: BuilderProjectTransaction,
  input: {
    projectId: string
    clientMutationId: string
    commandType: BuilderProjectMutationCommandType
    requestHash: string
  },
) {
  const [inserted] = await transaction
    .insert(builderProjectMutationReceipts)
    .values(input)
    .onConflictDoNothing({
      target: [
        builderProjectMutationReceipts.projectId,
        builderProjectMutationReceipts.clientMutationId,
      ],
    })
    .returning({ projectId: builderProjectMutationReceipts.projectId })
  if (inserted) return true

  const [existing] = await transaction
    .select({
      commandType: builderProjectMutationReceipts.commandType,
      requestHash: builderProjectMutationReceipts.requestHash,
    })
    .from(builderProjectMutationReceipts)
    .where(
      and(
        eq(builderProjectMutationReceipts.projectId, input.projectId),
        eq(
          builderProjectMutationReceipts.clientMutationId,
          input.clientMutationId,
        ),
      ),
    )
    .for('update')
    .limit(1)
  if (!existing || !isMatchingBuilderProjectMutationReceipt(input, existing)) {
    throw new BuilderProjectConflictError(
      'Builder mutation ID was already used for a different command',
    )
  }
  return false
}

async function interruptExpiredRunsInTransaction(
  transaction: BuilderProjectTransaction,
  projectId: string,
  ownerId: string,
  occurredAt = new Date(),
) {
  const expiredRuns = await transaction
    .select()
    .from(builderProjectRuns)
    .where(
      and(
        eq(builderProjectRuns.projectId, projectId),
        eq(builderProjectRuns.status, 'running'),
        lte(builderProjectRuns.leaseExpiresAt, occurredAt),
      ),
    )
    .for('update')

  const interrupted: Array<typeof builderProjectRuns.$inferSelect> = []
  for (const expired of expiredRuns) {
    const [run] = await transaction
      .update(builderProjectRuns)
      .set({
        status: 'interrupted',
        leaseOwnerId: null,
        leaseExpiresAt: null,
        completedAt: occurredAt,
        updatedAt: occurredAt,
      })
      .where(eq(builderProjectRuns.id, expired.id))
      .returning()
    interrupted.push(run)
    await appendEventInTransaction(transaction, {
      projectId,
      ownerId,
      clientEventId: crypto.randomUUID(),
      clientMutationId: crypto.randomUUID(),
      browserSessionId: expired.leaseOwnerId ?? undefined,
      threadId: run.threadId,
      runId: run.id,
      type: 'run.interrupted',
      payload: { run: syncRun(run), reason: 'lease-expired' },
      occurredAt,
      allowQuotaOverflow: true,
    })
  }
  return interrupted
}

export function getDeletedBuilderProjectRunState(occurredAt: Date) {
  return {
    status: 'cancelled' as const,
    leaseOwnerId: null,
    leaseExpiresAt: null,
    completedAt: occurredAt,
    updatedAt: occurredAt,
  }
}

async function cancelNonterminalRunsForDeletedProjectInTransaction(
  transaction: BuilderProjectTransaction,
  project: typeof builderProjects.$inferSelect,
  occurredAt: Date,
  clientMutationId: string,
) {
  const nonterminalRuns = await transaction
    .select()
    .from(builderProjectRuns)
    .where(
      and(
        eq(builderProjectRuns.projectId, project.id),
        inArray(
          builderProjectRuns.status,
          builderProjectNonterminalRunStatuses,
        ),
      ),
    )
    .for('update')

  const cancelled: Array<typeof builderProjectRuns.$inferSelect> = []
  for (const current of nonterminalRuns) {
    const [run] = await transaction
      .update(builderProjectRuns)
      .set(getDeletedBuilderProjectRunState(occurredAt))
      .where(eq(builderProjectRuns.id, current.id))
      .returning()
    cancelled.push(run)
    await appendEventInTransaction(transaction, {
      projectId: project.id,
      ownerId: project.ownerId,
      clientEventId: crypto.randomUUID(),
      clientMutationId,
      browserSessionId: current.leaseOwnerId ?? undefined,
      threadId: run.threadId,
      runId: run.id,
      type: 'run.cancelled',
      payload: { run: syncRun(run), reason: 'project-deleted' },
      occurredAt,
      skipUsage: true,
    })
  }
  return cancelled
}

export const builderProjectNonterminalRunStatuses = [
  'pending',
  'running',
] as const

async function listMutationEventsInTransaction(
  transaction: BuilderProjectTransaction,
  projectId: string,
  clientMutationId: string,
) {
  const rows = await transaction
    .select()
    .from(builderProjectEvents)
    .where(
      and(
        eq(builderProjectEvents.projectId, projectId),
        eq(builderProjectEvents.clientMutationId, clientMutationId),
      ),
    )
    .orderBy(asc(builderProjectEvents.sequence))
  return rows.map(toBuilderProjectEvent)
}

function commandResult(
  clientMutationId: string,
  events: Array<BuilderProjectEvent>,
  leaseFencingToken?: number,
  headSequence?: number,
) {
  const sequence = events.at(-1)?.sequence ?? headSequence ?? 0
  return {
    clientMutationId,
    sequence,
    events,
    ...(leaseFencingToken === undefined ? {} : { leaseFencingToken }),
  }
}

function getLeaseDuration(value = 30_000) {
  if (!Number.isSafeInteger(value) || value < 5_000 || value > 300_000) {
    throw new Error('Invalid Builder project run lease duration')
  }
  return value
}

function getBuilderThreadTitle(content: string) {
  return content.trim().replace(/\s+/g, ' ').slice(0, 160)
}

function terminalEventType(
  status:
    | 'pending'
    | 'running'
    | 'interrupted'
    | 'completed'
    | 'failed'
    | 'cancelled',
): BuilderProjectEventType {
  if (status === 'interrupted') return 'run.interrupted'
  if (status === 'completed') return 'run.completed'
  if (status === 'failed') return 'run.failed'
  if (status === 'cancelled') return 'run.cancelled'
  throw new BuilderProjectConflictError('Builder project run is not terminal')
}

type BuilderProjectUsageDelta = {
  threads?: number
  messages?: number
  runs?: number
  revisions?: number
  events?: number
  payloadBytes: SQL<number>
}

function getJsonbPayloadBytes(value: BuilderJsonValue | undefined) {
  return value === undefined || value === null
    ? sql<number>`0`
    : sql<number>`pg_column_size(${JSON.stringify(value)}::jsonb)`
}

async function incrementBuilderProjectUsageInTransaction(
  transaction: BuilderProjectTransaction,
  projectId: string,
  delta: BuilderProjectUsageDelta,
  enforceQuota = true,
) {
  const threads = delta.threads ?? 0
  const messages = delta.messages ?? 0
  const runs = delta.runs ?? 0
  const revisions = delta.revisions ?? 0
  const events = delta.events ?? 0
  const limits = enforceQuota
    ? builderProjectQuotaLimits
    : builderProjectQuotaHardLimits
  const [updated] = await transaction
    .update(builderProjectUsage)
    .set({
      threads: sql`${builderProjectUsage.threads} + ${threads}`,
      messages: sql`${builderProjectUsage.messages} + ${messages}`,
      runs: sql`${builderProjectUsage.runs} + ${runs}`,
      revisions: sql`${builderProjectUsage.revisions} + ${revisions}`,
      events: sql`${builderProjectUsage.events} + ${events}`,
      payloadBytes: sql`${builderProjectUsage.payloadBytes} + ${delta.payloadBytes}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(builderProjectUsage.projectId, projectId),
        lte(sql`${builderProjectUsage.threads} + ${threads}`, limits.threads),
        lte(
          sql`${builderProjectUsage.messages} + ${messages}`,
          limits.messages,
        ),
        lte(sql`${builderProjectUsage.runs} + ${runs}`, limits.runs),
        lte(
          sql`${builderProjectUsage.revisions} + ${revisions}`,
          limits.revisions,
        ),
        lte(sql`${builderProjectUsage.events} + ${events}`, limits.events),
        lte(
          sql`${builderProjectUsage.payloadBytes} + ${delta.payloadBytes}`,
          limits.payloadBytes,
        ),
      ),
    )
    .returning({ projectId: builderProjectUsage.projectId })
  if (updated) return

  const [usage] = await transaction
    .select()
    .from(builderProjectUsage)
    .where(eq(builderProjectUsage.projectId, projectId))
    .limit(1)
  if (!usage) {
    await rebuildBuilderProjectUsageInTransaction(transaction, projectId)
    return incrementBuilderProjectUsageInTransaction(
      transaction,
      projectId,
      delta,
      enforceQuota,
    )
  }
  const nextUsage = {
    threads: usage.threads + threads,
    messages: usage.messages + messages,
    runs: usage.runs + runs,
    revisions: usage.revisions + revisions,
    events: usage.events + events,
    payloadBytes: limits.payloadBytes + 1,
  }
  if (enforceQuota) assertBuilderProjectQuotaUsage(nextUsage)
  else assertBuilderProjectQuotaHardUsage(nextUsage)
  throw new BuilderProjectConflictError()
}

async function rebuildBuilderProjectUsageInTransaction(
  transaction: BuilderProjectTransaction,
  projectId: string,
) {
  const [usage] = await transaction
    .select({
      threads: sql<number>`(SELECT count(*)::int FROM ${builderProjectThreads} WHERE ${builderProjectThreads.projectId} = ${projectId})`,
      messages: sql<number>`(SELECT count(*)::int FROM ${builderProjectMessages} WHERE ${builderProjectMessages.projectId} = ${projectId})`,
      runs: sql<number>`(SELECT count(*)::int FROM ${builderProjectRuns} WHERE ${builderProjectRuns.projectId} = ${projectId})`,
      revisions: sql<number>`(SELECT count(*)::int FROM ${builderProjectRevisions} WHERE ${builderProjectRevisions.projectId} = ${projectId})`,
      events: sql<number>`(SELECT count(*)::int FROM ${builderProjectEvents} WHERE ${builderProjectEvents.projectId} = ${projectId})`,
      payloadBytes: sql<number>`(
        COALESCE((SELECT sum(octet_length(${builderProjectThreads.title})) FROM ${builderProjectThreads} WHERE ${builderProjectThreads.projectId} = ${projectId}), 0)
        + COALESCE((SELECT sum(octet_length(${builderProjectMessages.content}) + pg_column_size(${builderProjectMessages.parts})) FROM ${builderProjectMessages} WHERE ${builderProjectMessages.projectId} = ${projectId}), 0)
        + COALESCE((SELECT sum(octet_length(${builderProjectRuns.provider}) + octet_length(${builderProjectRuns.model}) + COALESCE(pg_column_size(${builderProjectRuns.error}), 0) + COALESCE(pg_column_size(${builderProjectRuns.activity}), 0)) FROM ${builderProjectRuns} WHERE ${builderProjectRuns.projectId} = ${projectId}), 0)
        + COALESCE((SELECT sum(pg_column_size(${builderProjectEvents.payload})) FROM ${builderProjectEvents} WHERE ${builderProjectEvents.projectId} = ${projectId}), 0)
      )::int`,
    })
    .from(builderProjects)
    .where(eq(builderProjects.id, projectId))
    .limit(1)
  if (!usage) throw new BuilderProjectNotFoundError()
  assertBuilderProjectQuotaUsage(usage)
  await transaction
    .insert(builderProjectUsage)
    .values({ projectId, ...usage, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: builderProjectUsage.projectId,
      set: { ...usage, updatedAt: new Date() },
    })
}

async function appendEventInTransaction(
  transaction: BuilderProjectTransaction,
  input: AppendBuilderProjectEventInput,
) {
  assertBuilderProjectEventPayload(input.payload)
  const [existing] = await transaction
    .select()
    .from(builderProjectEvents)
    .where(
      and(
        eq(builderProjectEvents.projectId, input.projectId),
        eq(builderProjectEvents.clientEventId, input.clientEventId),
      ),
    )
    .limit(1)
  if (existing) return toBuilderProjectEvent(existing)

  const [project] = await transaction
    .update(builderProjects)
    .set({
      lastEventSequence: sql`${builderProjects.lastEventSequence} + 1`,
    })
    .where(
      and(
        eq(builderProjects.id, input.projectId),
        eq(builderProjects.ownerId, input.ownerId),
      ),
    )
    .returning({ sequence: builderProjects.lastEventSequence })
  if (!project) throw new BuilderProjectOwnershipError()

  const [event] = await transaction
    .insert(builderProjectEvents)
    .values({
      projectId: input.projectId,
      ownerId: input.ownerId,
      threadId: input.threadId,
      revisionId: input.revisionId,
      messageId: input.messageId,
      runId: input.runId,
      sequence: project.sequence,
      clientEventId: input.clientEventId,
      clientMutationId: input.clientMutationId,
      browserSessionId: input.browserSessionId,
      type: input.type,
      payload: input.payload,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .returning()
  if (!input.skipUsage) {
    await incrementBuilderProjectUsageInTransaction(
      transaction,
      input.projectId,
      {
        events: 1,
        payloadBytes: sql<number>`pg_column_size(${JSON.stringify(input.payload)}::jsonb)`,
      },
      !input.allowQuotaOverflow,
    )
  }
  return toBuilderProjectEvent(event)
}

async function lockOwnedProject(
  transaction: BuilderProjectTransaction,
  projectId: string,
  ownerId: string,
  includeDeleted = false,
) {
  const [project] = await transaction
    .select()
    .from(builderProjects)
    .where(eq(builderProjects.id, projectId))
    .for('update')
    .limit(1)
  if (!project) throw new BuilderProjectNotFoundError()
  if (project.ownerId !== ownerId) throw new BuilderProjectOwnershipError()
  if (project.deletedAt && !includeDeleted)
    throw new BuilderProjectDeletedError()
  return project
}

async function selectBuilderProjectState(
  projectId: string,
  database: Pick<typeof db, 'select'> = db,
) {
  const [project] = await database
    .select({
      id: builderProjects.id,
      ownerId: builderProjects.ownerId,
      forkedFromId: builderProjects.forkedFromId,
      title: builderProjects.title,
      description: builderProjects.description,
      snapshotHash: builderProjects.snapshotHash,
      currentRevisionId: builderProjectRevisions.id,
      currentRevisionNumber: builderProjects.currentRevisionNumber,
      lastEventSequence: builderProjects.lastEventSequence,
      lastLeaseFencingToken: builderProjects.lastLeaseFencingToken,
      createdAt: builderProjects.createdAt,
      updatedAt: builderProjects.updatedAt,
      deletedAt: builderProjects.deletedAt,
      authorName: users.name,
      authorDisplayUsername: users.displayUsername,
      authorImage: users.image,
      authorOauthImage: users.oauthImage,
    })
    .from(builderProjects)
    .innerJoin(users, eq(builderProjects.ownerId, users.id))
    .innerJoin(
      builderProjectRevisions,
      and(
        eq(builderProjectRevisions.projectId, builderProjects.id),
        eq(
          builderProjectRevisions.revisionNumber,
          builderProjects.currentRevisionNumber,
        ),
      ),
    )
    .where(eq(builderProjects.id, projectId))
    .limit(1)
  return project
}

export type BuilderProjectCreationReplayRecord = {
  project: {
    id: string
    ownerId: string
    clientMutationId: string
    forkedFromId: string | null
    createdAt: Date
  }
  revision: {
    id: string
    projectId: string
    ownerId: string
    clientMutationId: string
    parentRevisionId: string | null
    revisionNumber: number
    snapshotHash: string
    createdAt: Date
  }
  eventPayload: BuilderJsonObject
}

export function isMatchingBuilderProjectCreationReplay(
  input: CreateBuilderProjectStateInput,
  record: BuilderProjectCreationReplayRecord,
  matchRevisionId = true,
) {
  const eventProject = record.eventPayload.project
  if (!isRecord(eventProject)) return false

  const expectedCreatedAt = input.createdAt?.toISOString()
  const expectedUpdatedAt = (input.updatedAt ?? input.createdAt)?.toISOString()
  return (
    record.project.id === input.id &&
    record.project.ownerId === input.ownerId &&
    record.project.clientMutationId === input.clientMutationId &&
    record.project.forkedFromId === (input.forkedFromId ?? null) &&
    (expectedCreatedAt === undefined ||
      record.project.createdAt.toISOString() === expectedCreatedAt) &&
    (!matchRevisionId || record.revision.id === input.revisionId) &&
    record.revision.projectId === input.id &&
    record.revision.ownerId === input.ownerId &&
    record.revision.clientMutationId === input.clientMutationId &&
    record.revision.parentRevisionId === null &&
    record.revision.revisionNumber === 1 &&
    record.revision.snapshotHash === input.snapshotHash &&
    (expectedCreatedAt === undefined ||
      record.revision.createdAt.toISOString() === expectedCreatedAt) &&
    eventProject.id === input.id &&
    eventProject.ownerId === input.ownerId &&
    eventProject.forkedFromId === (input.forkedFromId ?? null) &&
    eventProject.title === input.title &&
    eventProject.description === input.description &&
    eventProject.snapshotHash === input.snapshotHash &&
    eventProject.currentRevisionId === record.revision.id &&
    eventProject.currentRevisionNumber === 1 &&
    (expectedCreatedAt === undefined ||
      eventProject.createdAt === expectedCreatedAt) &&
    (expectedUpdatedAt === undefined ||
      eventProject.updatedAt === expectedUpdatedAt)
  )
}

async function findProjectCreationByMutation(
  input: CreateBuilderProjectStateInput,
  matchRevisionId = true,
  database: Pick<typeof db, 'select'> = db,
) {
  const [row] = await database
    .select({ id: builderProjects.id })
    .from(builderProjects)
    .where(
      and(
        eq(builderProjects.ownerId, input.ownerId),
        eq(builderProjects.clientMutationId, input.clientMutationId),
      ),
    )
    .limit(1)
  return row
    ? requireMatchingBuilderProjectCreation(
        input,
        row.id,
        database,
        matchRevisionId,
      )
    : undefined
}

async function requireMatchingBuilderProjectCreation(
  input: CreateBuilderProjectStateInput,
  projectId: string,
  database: Pick<typeof db, 'select'> = db,
  matchRevisionId = true,
) {
  const [project] = await database
    .select({
      id: builderProjects.id,
      ownerId: builderProjects.ownerId,
      clientMutationId: builderProjects.clientMutationId,
      forkedFromId: builderProjects.forkedFromId,
      createdAt: builderProjects.createdAt,
    })
    .from(builderProjects)
    .where(eq(builderProjects.id, projectId))
    .limit(1)
  const [revision] = await database
    .select({
      id: builderProjectRevisions.id,
      projectId: builderProjectRevisions.projectId,
      ownerId: builderProjectRevisions.ownerId,
      clientMutationId: builderProjectRevisions.clientMutationId,
      parentRevisionId: builderProjectRevisions.parentRevisionId,
      revisionNumber: builderProjectRevisions.revisionNumber,
      snapshotHash: builderProjectRevisions.snapshotHash,
      createdAt: builderProjectRevisions.createdAt,
    })
    .from(builderProjectRevisions)
    .where(
      and(
        eq(builderProjectRevisions.projectId, projectId),
        eq(builderProjectRevisions.clientMutationId, input.clientMutationId),
      ),
    )
    .limit(1)
  const [createdEvent] = await database
    .select({ payload: builderProjectEvents.payload })
    .from(builderProjectEvents)
    .where(
      and(
        eq(builderProjectEvents.projectId, projectId),
        eq(builderProjectEvents.clientMutationId, input.clientMutationId),
        eq(builderProjectEvents.type, 'project.created'),
      ),
    )
    .limit(1)

  if (
    !project ||
    !revision ||
    !createdEvent ||
    !isMatchingBuilderProjectCreationReplay(
      input,
      {
        project,
        revision,
        eventPayload: createdEvent.payload,
      },
      matchRevisionId,
    )
  ) {
    throw new BuilderProjectConflictError(
      'Builder project mutation conflicts with an existing project',
    )
  }

  const state = await selectBuilderProjectState(projectId, database)
  if (!state) throw new BuilderProjectNotFoundError()
  return state
}

function toBuilderProjectEvent(
  row: BuilderProjectEventRow,
): BuilderProjectEvent {
  return {
    version: builderProjectEventVersion,
    id: row.id,
    projectId: row.projectId,
    ownerId: row.ownerId,
    threadId: row.threadId,
    revisionId: row.revisionId,
    messageId: row.messageId,
    runId: row.runId,
    sequence: row.sequence,
    clientEventId: row.clientEventId,
    clientMutationId: row.clientMutationId,
    browserSessionId: row.browserSessionId,
    type: row.type,
    payload: row.payload,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

function projectPayload(
  project: typeof builderProjects.$inferSelect,
  currentRevisionId: string,
) {
  return {
    project: {
      id: project.id,
      ownerId: project.ownerId,
      forkedFromId: project.forkedFromId,
      title: project.title,
      description: project.description,
      snapshotHash: project.snapshotHash,
      currentRevisionId,
      currentRevisionNumber: project.currentRevisionNumber,
      lastEventSequence: project.lastEventSequence,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
  }
}

function revisionPayload(
  revision: typeof builderProjectRevisions.$inferSelect,
) {
  return {
    revision: {
      id: revision.id,
      projectId: revision.projectId,
      ownerId: revision.ownerId,
      clientMutationId: revision.clientMutationId,
      parentRevisionId: revision.parentRevisionId,
      revisionNumber: revision.revisionNumber,
      snapshotHash: revision.snapshotHash,
      createdAt: revision.createdAt.toISOString(),
    },
  }
}

function syncProject(project: NonNullable<BuilderProjectState>) {
  return {
    id: project.id,
    ownerId: project.ownerId,
    forkedFromId: project.forkedFromId,
    title: project.title,
    description: project.description,
    snapshotHash: project.snapshotHash,
    currentRevisionId: project.currentRevisionId,
    currentRevisionNumber: project.currentRevisionNumber,
    lastEventSequence: project.lastEventSequence,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function syncThread(thread: typeof builderProjectThreads.$inferSelect) {
  return {
    id: thread.id,
    projectId: thread.projectId,
    ownerId: thread.ownerId,
    clientMutationId: thread.clientMutationId,
    title: thread.title,
    lastMessagePosition: thread.lastMessagePosition,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    archivedAt: thread.archivedAt?.toISOString() ?? null,
  }
}

function syncMessage(message: typeof builderProjectMessages.$inferSelect) {
  return {
    id: message.id,
    projectId: message.projectId,
    ownerId: message.ownerId,
    threadId: message.threadId,
    runId: message.runId,
    clientMutationId: message.clientMutationId,
    role: message.role,
    content: message.content,
    parts: message.parts,
    position: message.position,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  }
}

function syncRun(run: typeof builderProjectRuns.$inferSelect) {
  return {
    id: run.id,
    projectId: run.projectId,
    ownerId: run.ownerId,
    threadId: run.threadId,
    clientMutationId: run.clientMutationId,
    status: run.status,
    queueKind: run.queueKind,
    provider: run.provider,
    model: run.model,
    baseRevisionId: run.baseRevisionId,
    resultRevisionId: run.resultRevisionId,
    leaseOwnerId: run.leaseOwnerId,
    leaseFencingToken: run.leaseFencingToken,
    leaseExpiresAt: run.leaseExpiresAt?.toISOString() ?? null,
    lastHeartbeatAt: run.lastHeartbeatAt?.toISOString() ?? null,
    error: run.error,
    activity: run.activity,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

async function withBuilderProjectConstraintErrors<TResult>(
  operation: () => Promise<TResult>,
  message: string,
) {
  try {
    return await operation()
  } catch (error) {
    if (isBuilderProjectConstraintViolation(error)) {
      throw new BuilderProjectConflictError(message)
    }
    throw error
  }
}

function isUniqueViolation(error: unknown) {
  return getPostgresErrorCode(error) === '23505'
}

function isBuilderProjectConstraintViolation(error: unknown) {
  const code = getPostgresErrorCode(error)
  return (
    code === '23502' ||
    code === '23503' ||
    code === '23505' ||
    code === '23514' ||
    code === '23P01'
  )
}

function getPostgresErrorCode(error: unknown, depth = 0): string | undefined {
  if (!isRecord(error) || depth > 3) return undefined
  if (typeof error.code === 'string') return error.code
  return getPostgresErrorCode(error.cause, depth + 1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
