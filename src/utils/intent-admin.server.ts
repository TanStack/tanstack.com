/**
 * Admin server functions for managing the Intent skills registry.
 * All functions require the 'admin' capability.
 */

import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import { db } from '~/db/client'
import {
  intentPackages,
  intentPackageVersions,
  intentSkills,
} from '~/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { requireCapability } from './auth.server'
import {
  fetchPackument,
  selectVersionsToSync,
  extractSkillsFromTarball,
} from './intent.server'
import {
  discoverIntentPackagesFromNpm,
  discoverIntentPackagesViaGitHub,
} from './intent-discovery.server'
import {
  upsertIntentPackage,
  getKnownVersions,
  enqueuePackageVersion,
  replaceSkillsForVersion,
  getPendingVersions,
  markVersionSynced,
  markVersionFailed,
} from './intent-db.server'

// ---------------------------------------------------------------------------
// Stats / overview
// ---------------------------------------------------------------------------

export const getIntentAdminStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const [
      totalPackages,
      verifiedPackages,
      pendingVersions,
      failedVersions,
      syncedVersions,
      totalSkills,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(intentPackages),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intentPackages)
        .where(eq(intentPackages.verified, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intentPackageVersions)
        .where(eq(intentPackageVersions.syncStatus, 'pending')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intentPackageVersions)
        .where(eq(intentPackageVersions.syncStatus, 'failed')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intentPackageVersions)
        .where(eq(intentPackageVersions.syncStatus, 'synced')),
      db.select({ count: sql<number>`count(*)::int` }).from(intentSkills),
    ])

    return {
      totalPackages: totalPackages[0]?.count ?? 0,
      verifiedPackages: verifiedPackages[0]?.count ?? 0,
      pendingVersions: pendingVersions[0]?.count ?? 0,
      failedVersions: failedVersions[0]?.count ?? 0,
      syncedVersions: syncedVersions[0]?.count ?? 0,
      totalSkills: totalSkills[0]?.count ?? 0,
    }
  },
)

// ---------------------------------------------------------------------------
// Package list (all known packages with status)
// ---------------------------------------------------------------------------

export const listIntentPackages = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const packages = await db.query.intentPackages.findMany({
      orderBy: [desc(intentPackages.lastSyncedAt)],
    })

    // Attach per-package version counts by status
    const versionCounts = await db
      .select({
        packageName: intentPackageVersions.packageName,
        syncStatus: intentPackageVersions.syncStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(intentPackageVersions)
      .groupBy(
        intentPackageVersions.packageName,
        intentPackageVersions.syncStatus,
      )

    const countsByPkg = new Map<
      string,
      { pending: number; synced: number; failed: number }
    >()
    for (const row of versionCounts) {
      const existing = countsByPkg.get(row.packageName) ?? {
        pending: 0,
        synced: 0,
        failed: 0,
      }
      if (row.syncStatus === 'pending') existing.pending = row.count
      else if (row.syncStatus === 'synced') existing.synced = row.count
      else if (row.syncStatus === 'failed') existing.failed = row.count
      countsByPkg.set(row.packageName, existing)
    }

    return packages.map((pkg) => ({
      ...pkg,
      versions: countsByPkg.get(pkg.name) ?? {
        pending: 0,
        synced: 0,
        failed: 0,
      },
    }))
  },
)

// ---------------------------------------------------------------------------
// Failed versions (for targeted retry)
// ---------------------------------------------------------------------------

export const listFailedVersions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    return db.query.intentPackageVersions.findMany({
      where: eq(intentPackageVersions.syncStatus, 'failed'),
      orderBy: [desc(intentPackageVersions.createdAt)],
    })
  },
)

// ---------------------------------------------------------------------------
// Trigger: run discovery phase (same logic as the scheduled function)
// ---------------------------------------------------------------------------

export const triggerIntentDiscover = createServerFn({
  method: 'POST',
}).handler(async () => {
  await requireCapability({ data: { capability: 'admin' } })

  return discoverIntentPackagesFromNpm()
})

// ---------------------------------------------------------------------------
// Trigger: process N pending versions (respects a time budget)
// ---------------------------------------------------------------------------

export const triggerIntentProcess = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      // Max versions to process in this call. Defaults to 10 for admin
      // (lower than the scheduled function to keep the request responsive).
      limit: v.optional(v.number(), 10),
    }),
  )
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    const pending = await getPendingVersions(data.limit)
    const results: Array<{
      packageName: string
      version: string
      status: 'synced' | 'failed'
      skillCount?: number
      error?: string
    }> = []

    for (const item of pending) {
      if (!item.tarballUrl) {
        await markVersionFailed(item.id, 'No tarball URL recorded')
        results.push({
          packageName: item.packageName,
          version: item.version,
          status: 'failed',
          error: 'No tarball URL recorded',
        })
        continue
      }

      try {
        const skills = await extractSkillsFromTarball(item.tarballUrl)
        await replaceSkillsForVersion(item.id, skills)
        await markVersionSynced(item.id, skills.length)
        results.push({
          packageName: item.packageName,
          version: item.version,
          status: 'synced',
          skillCount: skills.length,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        await markVersionFailed(item.id, error)
        results.push({
          packageName: item.packageName,
          version: item.version,
          status: 'failed',
          error,
        })
      }
    }

    return { processed: results.length, results }
  })

// ---------------------------------------------------------------------------
// Trigger: retry a specific failed version by id
// ---------------------------------------------------------------------------

export const retryIntentVersion = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ versionId: v.number() }))
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    const version = await db.query.intentPackageVersions.findFirst({
      where: eq(intentPackageVersions.id, data.versionId),
    })

    if (!version) throw new Error(`Version ${data.versionId} not found`)
    if (!version.tarballUrl)
      throw new Error('No tarball URL recorded for this version')

    // Reset to pending so the process trigger picks it up, or process inline
    const skills = await extractSkillsFromTarball(version.tarballUrl)
    await replaceSkillsForVersion(version.id, skills)
    await markVersionSynced(version.id, skills.length)

    return { skillCount: skills.length }
  })

// ---------------------------------------------------------------------------
// Discover intent-compatible packages via GitHub code search.
// Finds repos with @tanstack/intent in package.json, resolves npm package
// names, and enqueues any that have SKILL.md files in their published tarball.
// ---------------------------------------------------------------------------

export const discoverViaGitHub = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    return discoverIntentPackagesViaGitHub()
  },
)

// ---------------------------------------------------------------------------
// Manually seed a specific package by name, bypassing keyword discovery.
// Useful for packages that ship skills but haven't yet published the keyword.
// ---------------------------------------------------------------------------

export const seedIntentPackage = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ name: v.string() }))
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    const packument = await fetchPackument(data.name)
    const latestVersion = packument['dist-tags'].latest
    if (!latestVersion)
      throw new Error(`No latest version found for ${data.name}`)

    await upsertIntentPackage({ name: data.name, verified: true })

    const knownVersions = await getKnownVersions(data.name)
    const versionsToEnqueue = selectVersionsToSync(packument, knownVersions)

    let versionsEnqueued = 0
    for (const { version, tarball, publishedAt } of versionsToEnqueue) {
      await enqueuePackageVersion({
        packageName: data.name,
        version,
        tarballUrl: tarball,
        publishedAt,
      })
      versionsEnqueued++
    }

    return { versionsEnqueued }
  })

// ---------------------------------------------------------------------------
// Delete a package and all its versions/skills
// ---------------------------------------------------------------------------

export const deleteIntentPackage = createServerFn({ method: 'POST' })
  .inputValidator(v.object({ name: v.string() }))
  .handler(async ({ data }) => {
    await requireCapability({ data: { capability: 'admin' } })

    await db.delete(intentPackages).where(eq(intentPackages.name, data.name))

    return { deleted: true }
  })

// ---------------------------------------------------------------------------
// Reset failed versions back to pending (bulk retry)
// ---------------------------------------------------------------------------

export const resetFailedVersions = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireCapability({ data: { capability: 'admin' } })

    const result = await db
      .update(intentPackageVersions)
      .set({ syncStatus: 'pending', failureReason: null })
      .where(eq(intentPackageVersions.syncStatus, 'failed'))
      .returning({ id: intentPackageVersions.id })

    return { resetCount: result.length }
  },
)
