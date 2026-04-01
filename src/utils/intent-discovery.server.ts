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
} from './intent-db.server'

export type IntentNpmDiscoveryResult = {
  packagesDiscovered: number
  packagesVerified: number
  versionsEnqueued: number
  errors: Array<string>
}

export type IntentGitHubDiscoveryResult = {
  searched: number
  checkedOnNpm: number
  hadSkills: number
  enqueued: number
  skipped: number
  errors: Array<string>
}

type NpmLatestMetadata = {
  version?: string
  dist?: { tarball?: string }
}

async function enqueueDiscoveredVersions(packageName: string) {
  const packument = await fetchPackument(packageName)
  const knownVersions = await getKnownVersions(packageName)
  const versionsToEnqueue = selectVersionsToSync(packument, knownVersions)

  for (const { version, tarball, publishedAt } of versionsToEnqueue) {
    await enqueuePackageVersion({
      packageName,
      version,
      tarballUrl: tarball,
      publishedAt,
    })
  }

  return versionsToEnqueue.length
}

export async function discoverIntentPackagesFromNpm(): Promise<IntentNpmDiscoveryResult> {
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

      versionsEnqueued += await enqueueDiscoveredVersions(pkg.name)
    } catch (error) {
      errors.push(
        `${pkg.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return { packagesDiscovered, packagesVerified, versionsEnqueued, errors }
}

export async function discoverIntentPackagesViaGitHub(): Promise<IntentGitHubDiscoveryResult> {
  const githubToken = process.env.GITHUB_AUTH_TOKEN
  if (!githubToken) throw new Error('GITHUB_AUTH_TOKEN not set')

  const ghHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  }

  const searchRes = await fetch(
    'https://api.github.com/search/code?q=%22%40tanstack%2Fintent%22+filename%3Apackage.json&per_page=100',
    { headers: ghHeaders },
  )
  if (!searchRes.ok) {
    throw new Error(`GitHub search failed: ${searchRes.status}`)
  }

  const searchData = (await searchRes.json()) as {
    items: Array<{ path: string; repository: { full_name: string } }>
  }

  const seenRepoPaths = new Set<string>()
  const candidates = searchData.items.filter((item) => {
    const key = `${item.repository.full_name}|${item.path}`
    if (seenRepoPaths.has(key)) return false
    seenRepoPaths.add(key)
    return true
  })

  const results: IntentGitHubDiscoveryResult = {
    searched: candidates.length,
    checkedOnNpm: 0,
    hadSkills: 0,
    enqueued: 0,
    skipped: 0,
    errors: [],
  }

  const seenPackageNames = new Set<string>()

  for (const { repo, path } of candidates.map((item) => ({
    repo: item.repository.full_name,
    path: item.path,
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
      if (!pkgName || pkgJson.private || seenPackageNames.has(pkgName)) continue
      seenPackageNames.add(pkgName)

      results.checkedOnNpm++

      const npmRes = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
      )
      if (!npmRes.ok) continue

      const npmMeta = (await npmRes.json()) as NpmLatestMetadata
      const version = npmMeta.version
      const tarballUrl = npmMeta.dist?.tarball
      if (!version || !tarballUrl) continue

      const skills = await extractSkillsFromTarball(tarballUrl)
      if (skills.length === 0) {
        results.skipped++
        continue
      }

      results.hadSkills++

      await upsertIntentPackage({ name: pkgName, verified: true })
      await markPackageVerified(pkgName)

      results.enqueued += await enqueueDiscoveredVersions(pkgName)
    } catch (error) {
      results.errors.push(
        `${repo}/${path}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return results
}
