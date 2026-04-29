/// <reference types="node" />

import { algoliasearch } from 'algoliasearch'
import matter from 'gray-matter'
import { getBranch, libraries } from '../src/libraries'
import type { LibrarySlim } from '../src/libraries'
import {
  buildSearchRecordsForMarkdown,
  isExcludedFromSearchIndex,
} from '../src/utils/searchIndexGeneration'
import type { SearchRecord } from '../src/utils/searchRecords'

const DEFAULT_INDEX_NAME = 'TANSTACK_SG_TEST'
const DEFAULT_SITE_URL = 'https://tanstack.com'
const DEFAULT_PACKAGE_MANAGER = 'npm'

type GitHubTreeEntry = {
  path: string
  type: string
}

type SyncOptions = {
  indexName: string
  upload: boolean
  siteUrl: string
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  libraryIds: Set<string>
}

function readFlagValue(args: Array<string>, flag: string) {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  return args[index + 1]
}

function readRepeatedFlagValues(args: Array<string>, flag: string) {
  const values: Array<string> = []

  for (let index = 0; index < args.length; index++) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1])
    }
  }

  return values
}

function parsePackageManager(value: string | undefined) {
  if (
    value === 'npm' ||
    value === 'pnpm' ||
    value === 'yarn' ||
    value === 'bun'
  ) {
    return value
  }

  return DEFAULT_PACKAGE_MANAGER
}

function parseOptions(args: Array<string>): SyncOptions {
  return {
    indexName: readFlagValue(args, '--index') ?? DEFAULT_INDEX_NAME,
    upload: args.includes('--upload'),
    siteUrl: readFlagValue(args, '--site-url') ?? DEFAULT_SITE_URL,
    packageManager: parsePackageManager(readFlagValue(args, '--package-manager')),
    libraryIds: new Set(readRepeatedFlagValues(args, '--library')),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getBranchSha(value: unknown) {
  if (!isRecord(value) || !isRecord(value.commit)) {
    return null
  }

  return readString(value.commit.sha) ?? null
}

function getTreeEntries(value: unknown): Array<GitHubTreeEntry> {
  if (!isRecord(value) || !Array.isArray(value.tree)) {
    return []
  }

  return value.tree.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const path = readString(entry.path)
    const type = readString(entry.type)
    if (!path || !type) {
      return []
    }

    return [{ path, type }]
  })
}

async function fetchGitHubJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tanstack-search-index-sync',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}: ${url}`)
  }

  return response.json()
}

async function fetchRawFile(repo: string, branch: string, path: string) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'tanstack-search-index-sync',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Raw GitHub request failed with ${response.status}: ${url}`)
  }

  return response.text()
}

async function fetchRecursiveTree(repo: string, branch: string) {
  const branchResponse = await fetchGitHubJson(
    `https://api.github.com/repos/${repo}/branches/${branch}`,
  )
  const branchSha = getBranchSha(branchResponse)

  if (!branchSha) {
    return []
  }

  const treeResponse = await fetchGitHubJson(
    `https://api.github.com/repos/${repo}/git/trees/${branchSha}?recursive=1`,
  )

  return getTreeEntries(treeResponse)
}

function getDocsRoot(library: LibrarySlim) {
  return library.docsRoot || 'docs'
}

function getDocsPath(filePath: string, docsRoot: string) {
  const prefix = `${docsRoot.replace(/\/+$/g, '')}/`

  if (!filePath.startsWith(prefix)) {
    return null
  }

  return filePath
    .slice(prefix.length)
    .replace(/\.md$/i, '')
    .replace(/\/index$/i, '')
}

function fallbackTitle(docsPath: string, library: LibrarySlim) {
  const lastSegment = docsPath.split('/').filter(Boolean).at(-1)
  if (!lastSegment) {
    return library.name
  }

  return lastSegment
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}

function getFrontmatterTitle(data: Record<string, unknown>) {
  const title = data.title
  return typeof title === 'string' ? title : undefined
}

async function buildLibraryRecords(
  library: LibrarySlim,
  options: SyncOptions,
) {
  const branch = getBranch(library, 'latest')
  const docsRoot = getDocsRoot(library)
  const tree = await fetchRecursiveTree(library.repo, branch)
  const markdownFiles = tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path)
    .filter((path) => path.endsWith('.md'))
    .filter((path) => getDocsPath(path, docsRoot) !== null)

  const records: Array<SearchRecord> = []

  for (const filePath of markdownFiles) {
    const docsPath = getDocsPath(filePath, docsRoot)
    if (docsPath === null) {
      continue
    }

    const markdown = await fetchRawFile(library.repo, branch, filePath)
    if (!markdown) {
      continue
    }

    const parsed = matter(markdown)
    const title = getFrontmatterTitle(parsed.data) ?? fallbackTitle(docsPath, library)
    const fileRecords = await buildSearchRecordsForMarkdown({
      library,
      version: 'latest',
      docsPath,
      title,
      content: parsed.content,
      siteUrl: options.siteUrl,
      packageManager: options.packageManager,
    })

    records.push(...fileRecords)
  }

  return records
}

function toAlgoliaObject(record: SearchRecord): Record<string, unknown> {
  return {
    objectID: record.objectID,
    url: record.url,
    anchor: record.anchor,
    urlWithAnchor: record.urlWithAnchor,
    library: record.library,
    framework: record.framework,
    version: record.version,
    routeStyle: record.routeStyle,
    hierarchy: record.hierarchy,
    content: record.content,
  }
}

async function uploadRecords(indexName: string, records: Array<SearchRecord>) {
  const appId = process.env.ALGOLIA_APPLICATION_ID
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY

  if (!appId || !apiKey) {
    throw new Error(
      'ALGOLIA_APPLICATION_ID and ALGOLIA_ADMIN_API_KEY are required with --upload.',
    )
  }

  if (!records.length) {
    throw new Error('Refusing to upload an empty search index.')
  }

  const client = algoliasearch(appId, apiKey)

  await client.setSettings({
    indexName,
    indexSettings: {
      attributesForFaceting: [
        'filterOnly(library)',
        'filterOnly(framework)',
        'filterOnly(version)',
        'filterOnly(routeStyle)',
      ],
      searchableAttributes: [
        'unordered(hierarchy.lvl1)',
        'unordered(hierarchy.lvl2)',
        'unordered(hierarchy.lvl3)',
        'unordered(hierarchy.lvl4)',
        'unordered(hierarchy.lvl5)',
        'unordered(hierarchy.lvl6)',
        'content',
      ],
      attributesToRetrieve: [
        'hierarchy.lvl1',
        'hierarchy.lvl2',
        'hierarchy.lvl3',
        'hierarchy.lvl4',
        'hierarchy.lvl5',
        'hierarchy.lvl6',
        'url',
        'anchor',
        'urlWithAnchor',
        'content',
        'library',
        'framework',
        'version',
        'routeStyle',
      ],
      attributesToHighlight: [
        'hierarchy.lvl1',
        'hierarchy.lvl2',
        'hierarchy.lvl3',
        'hierarchy.lvl4',
        'hierarchy.lvl5',
        'hierarchy.lvl6',
        'content',
      ],
      attributesToSnippet: ['content:50'],
    },
  })

  await client.replaceAllObjects({
    indexName,
    objects: records.map(toAlgoliaObject),
    batchSize: 1000,
    scopes: ['settings', 'rules', 'synonyms'],
  })
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const librariesToIndex = libraries.filter((library) => {
    if (library.visible === false || !library.latestVersion) {
      return false
    }

    if (!options.libraryIds.size) {
      return true
    }

    return options.libraryIds.has(library.id)
  })

  const records: Array<SearchRecord> = []

  for (const library of librariesToIndex) {
    console.log(`building ${library.id}`)
    const libraryRecords = await buildLibraryRecords(library, options)
    records.push(...libraryRecords)
    console.log(`- ${library.id}: ${libraryRecords.length} records`)
  }

  const excludedRegistryRecords = records.filter((record) =>
    isExcludedFromSearchIndex(record.urlWithAnchor),
  )

  if (excludedRegistryRecords.length) {
    throw new Error(
      `Generated ${excludedRegistryRecords.length} excluded registry records.`,
    )
  }

  console.log(`index: ${options.indexName}`)
  console.log(`records: ${records.length}`)
  console.log(options.upload ? 'mode: upload' : 'mode: dry-run')

  if (options.upload) {
    await uploadRecords(options.indexName, records)
    console.log(`uploaded ${records.length} records`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
