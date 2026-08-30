import { eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { builderProjectLegacyImports } from '~/db/schema'
import {
  BuilderProjectConflictError,
  BuilderProjectNotFoundError,
  getBuilderProjectState,
  importLegacyBuilderProjectState,
  listBuilderProjectStates,
  type BuilderProjectState,
} from './builder-project-events.server'
import {
  getStoredBuilderProject,
  getStoredBuilderProjectIdReservation,
  listStoredBuilderProjects,
} from './builder-project-storage.server'
import { builderProjectVersion, type BuilderProject } from './builder-project'
import { registerLegacyBuilderProjectSnapshot } from './builder-project-snapshot-registry.server'

export async function getOrImportBuilderProjectState(projectId: string) {
  try {
    return await getBuilderProjectState({ projectId })
  } catch (error) {
    if (!(error instanceof BuilderProjectNotFoundError)) throw error
  }

  const legacyProject = await getStoredBuilderProject(projectId)
  if (!legacyProject) throw new BuilderProjectNotFoundError()
  const project = await importLegacyProject(legacyProject)
  if (project.deletedAt) throw new BuilderProjectNotFoundError()
  return project
}

export async function reserveLegacyBuilderProjectId(projectId: string) {
  try {
    return await getBuilderProjectState({
      projectId,
      includeDeleted: true,
    })
  } catch (error) {
    if (!(error instanceof BuilderProjectNotFoundError)) throw error
  }

  const reservation = await getStoredBuilderProjectIdReservation(projectId)
  if (!reservation.reserved) return undefined
  if (!reservation.project) {
    throw new BuilderProjectConflictError('Builder project ID is reserved')
  }
  return importLegacyProject(reservation.project)
}

export async function listOrImportBuilderProjectStates(ownerId: string) {
  const existing = await listBuilderProjectStates({ ownerId })

  const [completedImport] = await db
    .select({ ownerId: builderProjectLegacyImports.ownerId })
    .from(builderProjectLegacyImports)
    .where(eq(builderProjectLegacyImports.ownerId, ownerId))
    .limit(1)
  if (completedImport) return existing

  const legacyProjects = orderLegacyBuilderProjectsForImport(
    await listStoredBuilderProjects(ownerId),
  )
  for (const project of legacyProjects) await importLegacyProject(project)
  await db
    .insert(builderProjectLegacyImports)
    .values({ ownerId })
    .onConflictDoNothing()

  return listBuilderProjectStates({ ownerId })
}

export function orderLegacyBuilderProjectsForImport(
  projects: Array<BuilderProject>,
) {
  const projectsById = new Map(
    projects.map((project) => [project.id, project] as const),
  )
  const ordered: Array<BuilderProject> = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(project: BuilderProject) {
    if (visited.has(project.id)) return
    if (visiting.has(project.id)) {
      throw new Error('Legacy Builder project fork cycle')
    }

    visiting.add(project.id)
    const source = project.forkedFromId
      ? projectsById.get(project.forkedFromId)
      : undefined
    if (source) visit(source)
    visiting.delete(project.id)
    visited.add(project.id)
    ordered.push(project)
  }

  for (const project of projects) visit(project)
  return ordered
}

export function toBuilderProject(
  project: NonNullable<BuilderProjectState>,
): BuilderProject {
  return {
    version: builderProjectVersion,
    id: project.id,
    ownerId: project.ownerId,
    snapshotHash: project.snapshotHash,
    currentRevisionId: project.currentRevisionId,
    currentRevisionNumber: project.currentRevisionNumber,
    ...(project.forkedFromId ? { forkedFromId: project.forkedFromId } : {}),
    title: project.title,
    description: project.description,
    author: {
      name: project.authorName ?? project.authorDisplayUsername,
      image: project.authorImage ?? project.authorOauthImage,
    },
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

async function importLegacyProject(
  project: BuilderProject,
  importing = new Set<string>(),
) {
  if (importing.has(project.id)) {
    throw new Error('Legacy Builder project fork cycle')
  }
  importing.add(project.id)

  let forkedFromId: string | undefined
  if (project.forkedFromId) {
    try {
      await getBuilderProjectState({ projectId: project.forkedFromId })
      forkedFromId = project.forkedFromId
    } catch (error) {
      if (!(error instanceof BuilderProjectNotFoundError)) throw error
      const source = await getStoredBuilderProject(project.forkedFromId)
      if (source) {
        await importLegacyProject(source, importing)
        forkedFromId = project.forkedFromId
      }
    }
  }

  importing.delete(project.id)
  await registerLegacyBuilderProjectSnapshot(
    project.ownerId,
    project.snapshotHash,
  )
  return importLegacyBuilderProjectState({
    id: project.id,
    ownerId: project.ownerId,
    clientMutationId: project.id,
    revisionId: crypto.randomUUID(),
    snapshotHash: project.snapshotHash,
    title: project.title,
    description: project.description,
    forkedFromId,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  })
}
