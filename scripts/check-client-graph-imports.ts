import fsp from 'node:fs/promises'
import path from 'node:path'

type Target = {
  dir: string
  exclude?: Array<RegExp>
}

const root = process.cwd()
const routeExtensions = new Set(['.ts', '.tsx'])
const violations: Array<string> = []

const targets: Array<Target> = [
  { dir: 'src/routes', exclude: [/^src\/routes\/api\//] },
  { dir: 'src/components', exclude: [/\.client\.[^/]+$/] },
  { dir: 'src/hooks' },
  { dir: 'src/queries' },
  { dir: 'src/libraries' },
]

const restrictedImportPatterns = [
  {
    pattern: /from\s+['"][^'"]*\.server(?:\.[^'"]+)?['"]$/,
    message: 'Top-level .server import in client-facing module.',
  },
  {
    pattern:
      /from\s+['"](?:~\/server\/|\.\.\/server\/|\.\/server\/|\.\.\/.*\/server\/|\.\/.*\/server\/)[^'"]*['"]$/,
    message: 'Top-level local /server/ import in client-facing module.',
  },
  {
    pattern: /from\s+['"][^'"]*\.client(?:\.[^'"]+)?['"]$/,
    message:
      'Top-level .client import in non-.client client-facing module. Split the boundary or lazy-load behind a client-only path.',
  },
]

function shouldExclude(relativePath: string, exclude: Array<RegExp> = []) {
  return exclude.some((pattern) => pattern.test(relativePath))
}

async function collectFiles(dir: string): Promise<Array<string>> {
  const entries = await fsp.readdir(path.join(root, dir), {
    withFileTypes: true,
  })
  const files: Array<string> = []

  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name)
    const fullPath = path.join(root, relativePath)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath)))
      continue
    }

    if (routeExtensions.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

async function checkFile(filePath: string) {
  const content = await fsp.readFile(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = path.relative(root, filePath)

  for (const [index, line] of lines.entries()) {
    const trimmedLine = line.trim()

    if (
      !trimmedLine.startsWith('import ') ||
      trimmedLine.startsWith('import type ')
    ) {
      continue
    }

    for (const rule of restrictedImportPatterns) {
      if (rule.pattern.test(trimmedLine)) {
        violations.push(`${relativePath}:${index + 1} ${rule.message}`)
      }
    }
  }
}

for (const target of targets) {
  const files = await collectFiles(target.dir)
  const filteredFiles = files.filter(
    (filePath) => !shouldExclude(path.relative(root, filePath), target.exclude),
  )

  await Promise.all(filteredFiles.map((filePath) => checkFile(filePath)))
}

if (violations.length > 0) {
  console.error('Found restricted client-graph imports:\n')
  console.error(violations.join('\n'))
  process.exit(1)
}
