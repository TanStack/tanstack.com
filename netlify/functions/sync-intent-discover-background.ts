import type { Config } from '@netlify/functions'
import {
  searchIntentPackages,
  fetchPackument,
  isIntentCompatible,
  selectVersionsToSync,
  extractSkillsFromTarball,
} from '~/utils/intent.server'
import {
  upsertIntentPackage,
  getKnownVersions,
  enqueuePackageVersion,
  markPackageVerified,
} from '~/utils/intent-db.server'

/**
 * Netlify Scheduled Function - Discover Intent-compatible npm packages
 *
 * Phase 1 of 2. Fast: no tarball downloads (except brief header peeks for GitHub path).
 *
 * Two discovery paths:
 *   1. NPM keyword search — instant, finds packages that published with tanstack-intent keyword
 *   2. GitHub code search — finds repos that depend on @tanstack/intent but may not have the keyword yet
 *
 * Both paths enqueue new versions for tarball processing (syncStatus = 'pending').
 * Actual skill extraction happens in sync-intent-process-background.
 *
 * Scheduled: Every 6 hours
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json()
  const startTime = Date.now()

  console.log('[intent-discover] Starting discovery (NPM + GitHub)...')

  let versionsEnqueued = 0
  const errors: Array<string> = []

  // ---------------------------------------------------------------------------
  // Path 1: NPM keyword search
  // ---------------------------------------------------------------------------
  try {
    console.log(
      '[intent-discover] Searching NPM for keywords:tanstack-intent...',
    )
    const searchResults = await searchIntentPackages()
    console.log(
      `[intent-discover] NPM found ${searchResults.objects.length} candidates`,
    )

    for (const { package: pkg } of searchResults.objects) {
      try {
        await upsertIntentPackage({ name: pkg.name, verified: false })

        const packument = await fetchPackument(pkg.name)
        const latestVersion = packument['dist-tags'].latest
        if (!latestVersion) continue

        const latestMeta = packument.versions[latestVersion]
        if (!latestMeta || !isIntentCompatible(latestMeta)) continue

        await markPackageVerified(pkg.name)

        const knownVersions = await getKnownVersions(pkg.name)
        const toEnqueue = selectVersionsToSync(packument, knownVersions)
        for (const { version, tarball, publishedAt } of toEnqueue) {
          await enqueuePackageVersion({
            packageName: pkg.name,
            version,
            tarballUrl: tarball,
            publishedAt,
          })
          versionsEnqueued++
        }
        console.log(
          `[intent-discover] NPM: ${pkg.name} - enqueued ${toEnqueue.length}`,
        )
      } catch (e) {
        const msg = `npm/${pkg.name}: ${e instanceof Error ? e.message : String(e)}`
        console.error(`[intent-discover] ${msg}`)
        errors.push(msg)
      }
    }
  } catch (e) {
    console.error(
      '[intent-discover] NPM path failed:',
      e instanceof Error ? e.message : String(e),
    )
  }

  // ---------------------------------------------------------------------------
  // Path 2: GitHub code search for @tanstack/intent dependents
  // ---------------------------------------------------------------------------
  const githubToken = process.env.GITHUB_AUTH_TOKEN
  if (githubToken) {
    try {
      console.log(
        '[intent-discover] Searching GitHub for @tanstack/intent dependents...',
      )
      const ghHeaders = {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      }

      const searchRes = await fetch(
        'https://api.github.com/search/code?q=%22%40tanstack%2Fintent%22+filename%3Apackage.json&per_page=100',
        { headers: ghHeaders },
      )
      if (!searchRes.ok) throw new Error(`GitHub search ${searchRes.status}`)

      const searchData = (await searchRes.json()) as {
        items: Array<{ path: string; repository: { full_name: string } }>
      }

      // Deduplicate repo+path pairs
      const seen = new Set<string>()
      const candidates = searchData.items.filter((item) => {
        const key = `${item.repository.full_name}|${item.path}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      console.log(
        `[intent-discover] GitHub found ${candidates.length} package.json files`,
      )

      for (const { repo, path } of candidates.map((i) => ({
        repo: i.repository.full_name,
        path: i.path,
      }))) {
        try {
          const contentRes = await fetch(
            `https://api.github.com/repos/${repo}/contents/${path}`,
            { headers: ghHeaders },
          )
          if (!contentRes.ok) continue

          const contentData = (await contentRes.json()) as { content?: string }
          if (!contentData.content) continue

          const pkgJson = JSON.parse(
            Buffer.from(contentData.content, 'base64').toString('utf-8'),
          ) as { name?: string; private?: boolean }

          const pkgName = pkgJson.name
          if (!pkgName || pkgJson.private) continue

          // Check NPM
          const npmRes = await fetch(
            `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
          )
          if (!npmRes.ok) continue

          const npmMeta = (await npmRes.json()) as {
            version?: string
            dist?: { tarball?: string }
          }
          if (!npmMeta.version || !npmMeta.dist?.tarball) continue

          // Peek at tarball for skills
          const skills = await extractSkillsFromTarball(npmMeta.dist.tarball)
          if (skills.length === 0) continue

          await upsertIntentPackage({ name: pkgName, verified: true })
          await markPackageVerified(pkgName)

          const packument = await fetchPackument(pkgName)
          const knownVersions = await getKnownVersions(pkgName)
          const toEnqueue = selectVersionsToSync(packument, knownVersions)

          for (const { version, tarball, publishedAt } of toEnqueue) {
            await enqueuePackageVersion({
              packageName: pkgName,
              version,
              tarballUrl: tarball,
              publishedAt,
            })
            versionsEnqueued++
          }
          if (toEnqueue.length > 0) {
            console.log(
              `[intent-discover] GitHub: ${pkgName} - enqueued ${toEnqueue.length}`,
            )
          }
        } catch (e) {
          const msg = `github/${repo}: ${e instanceof Error ? e.message : String(e)}`
          console.error(`[intent-discover] ${msg}`)
          errors.push(msg)
        }
      }
    } catch (e) {
      console.error(
        '[intent-discover] GitHub path failed:',
        e instanceof Error ? e.message : String(e),
      )
    }
  } else {
    console.warn(
      '[intent-discover] GITHUB_AUTH_TOKEN not set, skipping GitHub path',
    )
  }

  const duration = Date.now() - startTime
  console.log(
    `[intent-discover] Done in ${duration}ms - enqueued: ${versionsEnqueued}, errors: ${errors.length}`,
  )
  if (errors.length > 0)
    console.warn(`[intent-discover] Errors:\n  ${errors.join('\n  ')}`)
  console.log('[intent-discover] Next invocation at:', next_run)
}

export default handler

export const config: Config = {
  schedule: '0 */6 * * *', // Every 6 hours
}
