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
  searchIntentPackages,
  fetchPackument,
  isIntentCompatible,
  selectVersionsToSync,
  extractSkillsFromTarball,
} from './intent.server'
import {
  upsertIntentPackage,
  getKnownVersions,
  enqueuePackageVersion,
  markPackageVerified,
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

  let packagesDiscovered = 0
  let packagesVerified = 0
  let versionsEnqueued = 0
  const errors: Array<string> = []

  const searchResults = await searchIntentPackages()
  packagesDiscovered = searchResults.objects.length

  for (const { package: pkg } of searchResults.objects) {
    try {
      await upsertIntentPackage({ name: pkg.name, verified: false })

      const packument = await fetchPackument(pkg.name)
      const latestVersion = packument['dist-tags'].latest
      if (!latestVersion) continue

      const latestMeta = packument.versions[latestVersion]
      if (!latestMeta || !isIntentCompatible(latestMeta)) continue

      await markPackageVerified(pkg.name)
      packagesVerified++

      const knownVersions = await getKnownVersions(pkg.name)
      const versionsToEnqueue = selectVersionsToSync(packument, knownVersions)

      for (const { version, tarball, publishedAt } of versionsToEnqueue) {
        await enqueuePackageVersion({
          packageName: pkg.name,
          version,
          tarballUrl: tarball,
          publishedAt,
        })
        versionsEnqueued++
      }
    } catch (err) {
      errors.push(
        `${pkg.name}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { packagesDiscovered, packagesVerified, versionsEnqueued, errors }
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

    const token = process.env.GITHUB_AUTH_TOKEN
    if (!token) throw new Error('GITHUB_AUTH_TOKEN not set')

    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // Search GitHub for package.json files referencing @tanstack/intent
    const searchRes = await fetch(
      'https://api.github.com/search/code?q=%22%40tanstack%2Fintent%22+filename%3Apackage.json&per_page=100',
      { headers: ghHeaders },
    )
    if (!searchRes.ok)
      throw new Error(`GitHub search failed: ${searchRes.status}`)
    const searchData = (await searchRes.json()) as {
      total_count: number
      items: Array<{
        path: string
        repository: { full_name: string }
        url: string
      }>
    }

    // Deduplicate: one package.json per repo+path
    const seen = new Set<string>()
    const candidates: Array<{ repo: string; path: string }> = []
    for (const item of searchData.items) {
      const key = `${item.repository.full_name}|${item.path}`
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push({ repo: item.repository.full_name, path: item.path })
      }
    }

    const results = {
      searched: candidates.length,
      checkedOnNpm: 0,
      hadSkills: 0,
      enqueued: 0,
      skipped: 0,
      errors: [] as Array<string>,
    }

    for (const { repo, path } of candidates) {
      try {
        // Fetch the package.json content from GitHub
        const contentRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${path}`,
          { headers: ghHeaders },
        )
        if (!contentRes.ok) continue
        const contentData = (await contentRes.json()) as {
          content?: string
          encoding?: string
        }
        if (!contentData.content) continue

        const pkgJson = JSON.parse(
          Buffer.from(contentData.content, 'base64').toString('utf-8'),
        ) as { name?: string; private?: boolean }

        const pkgName = pkgJson.name
        if (!pkgName || pkgJson.private) continue

        results.checkedOnNpm++

        // Check NPM for the package and its latest tarball
        const npmRes = await fetch(
          `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
        )
        if (!npmRes.ok) continue // not published

        const npmMeta = (await npmRes.json()) as {
          version?: string
          dist?: { tarball?: string }
        }
        const version = npmMeta.version
        const tarballUrl = npmMeta.dist?.tarball
        if (!version || !tarballUrl) continue

        // Peek at tarball for SKILL.md files (stream headers only)
        const skills = await extractSkillsFromTarball(tarballUrl)
        if (skills.length === 0) {
          results.skipped++
          continue
        }

        results.hadSkills++

        // Seed into DB
        await upsertIntentPackage({ name: pkgName, verified: true })

        const knownVersions = await getKnownVersions(pkgName)
        const packument = await fetchPackument(pkgName)
        const versionsToEnqueue = selectVersionsToSync(packument, knownVersions)

        for (const v of versionsToEnqueue) {
          await enqueuePackageVersion({
            packageName: pkgName,
            version: v.version,
            tarballUrl: v.tarball,
            publishedAt: v.publishedAt,
          })
          results.enqueued++
        }
      } catch (err) {
        results.errors.push(
          `${repo}/${path}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return results
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
