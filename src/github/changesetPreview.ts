import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Octokit } from '@octokit/rest'
import assembleReleasePlan from '@changesets/assemble-release-plan'
import { parse as parseConfig } from '@changesets/config'
import parseChangeset from '@changesets/parse'

const reasonRank = (reason: 'Changeset' | 'Dependent') => {
  return reason === 'Changeset' ? 2 : 1
}

const fetchFile = async ({ owner, repo, ref, path, octokit }) => {
  const response = await octokit.repos.getContent({
    owner,
    repo,
    ref,
    path,
  })
  return Buffer.from(response.data.content, 'base64').toString('utf-8')
}

export const changesetPreview = async ({
  owner,
  repo,
  ref,
  pull_number,
  octokit,
}: {
  owner: string
  repo: string
  ref: string
  pull_number: number
  octokit: Octokit
}) => {
  const configFile = JSON.parse(
    await fetchFile({
      owner,
      repo,
      ref,
      path: '.changeset/config.json',
      octokit,
    }),
  )

  const changedFiles = await octokit.pulls.listFiles({
    repo,
    owner,
    pull_number,
  })

  const newChangesetPaths: Array<string> = []

  for (const file of changedFiles.data) {
    if (
      file.filename.startsWith('.changeset/') &&
      file.filename.endsWith('.md')
    ) {
      console.log(`Found changeset file: ${file.filename}`)
      newChangesetPaths.push(file.filename)
    }
  }

  const newChangesets = newChangesetPaths.map(async (url) => {
    console.log(`Fetching changeset from ${url}`)
    const content = await fetchFile({ owner, repo, ref, path: url, octokit })
    return parseChangeset(content)
  })

  const tree = await octokit.git.getTree({
    owner,
    repo,
    recursive: '1',
    tree_sha: ref,
  })

  const packages: string[] = []

  for (const item of tree.data.tree) {
    if (
      item.path.startsWith('packages/') &&
      item.path.endsWith('/package.json')
    ) {
      packages.push(dirname(item.path))
    }
  }

  const releasePlan = assembleReleasePlan(
    newChangesets,
    packages,
    configFile,
    undefined,
  )
  const releases = releasePlan.releases

  if (releases.length === 0) {
    const msg =
      'No changeset entries found. Merging this PR will not cause a version bump for any packages.\n'
    process.stdout.write(msg)
    if (values.output) {
      writeFileSync(values.output, msg)
      process.stdout.write(`Written to ${values.output}\n`)
    }
    return
  }

  // 6. Diff
  const bumps = []
  for (const release of releases) {
    if (release.oldVersion === release.newVersion) continue
    const reason = release.changesets.length !== 0 ? 'Changeset' : 'Dependent'
    bumps.push({ ...release, reason })
  }

  // Order by reason and name
  bumps.sort(
    (a, b) =>
      reasonRank(b.reason) - reasonRank(a.reason) ||
      a.name.localeCompare(b.name),
  )

  // 7. Build markdown
  const lines = []

  if (bumps.length === 0) {
    lines.push(
      'No version changes detected. Merging this PR will not cause a version bump for any packages.',
    )
  } else {
    const majorBumps = bumps.filter((b) => b.type === 'major')
    const minorBumps = bumps.filter((b) => b.type === 'minor')
    const patchBumps = bumps.filter((b) => b.type === 'patch')
    const directBumps = bumps.filter((b) => b.reason === 'Changeset')
    const indirectBumps = bumps.filter((b) => b.reason === 'Dependent')

    lines.push(
      `**${directBumps.length}** package(s) bumped directly, **${indirectBumps.length}** bumped as dependents.`,
    )
    lines.push('')

    if (majorBumps.length > 0) {
      lines.push('### 🟥 Major bumps')
      lines.push('')
      lines.push('| Package | Version | Reason |')
      lines.push('| --- | --- | --- |')
      for (const b of majorBumps) {
        lines.push(
          `| \`${b.name}\` | ${b.oldVersion} → ${b.newVersion} | ${b.reason} |`,
        )
      }
      lines.push('')
    }

    if (minorBumps.length > 0) {
      lines.push('### 🟨 Minor bumps')
      lines.push('')
      lines.push('| Package | Version | Reason |')
      lines.push('| --- | --- | --- |')
      for (const b of minorBumps) {
        lines.push(
          `| \`${b.name}\` | ${b.oldVersion} → ${b.newVersion} | ${b.reason} |`,
        )
      }
      lines.push('')
    }

    if (patchBumps.length > 0) {
      lines.push('### 🟩 Patch bumps')
      lines.push('')
      lines.push('| Package | Version | Reason |')
      lines.push('| --- | --- | --- |')
      for (const b of patchBumps) {
        lines.push(
          `| \`${b.name}\` | ${b.oldVersion} → ${b.newVersion} | ${b.reason} |`,
        )
      }
    }
  }

  lines.push('')
  const md = lines.join('\n')

  process.stdout.write(md)
  if (values.output) {
    writeFileSync(values.output, md)
    process.stdout.write(`Written to ${values.output}\n`)
  }
}
