import fsp from 'node:fs/promises'
import path from 'node:path'

const apiRoutesDir = path.resolve(process.cwd(), 'src/routes/api')
const routeExtensions = new Set(['.ts', '.tsx'])
const violations: Array<string> = []

const restrictedImportPatterns = [
  {
    pattern: /from\s+['"][^'"]*\.server(?:\.[^'"]+)?['"]$/,
    message:
      'Top-level .server import in API route. Move it inside the server handler.',
  },
  {
    pattern: /from\s+['"]node:[^'"]+['"]$/,
    message:
      'Top-level node:* import in API route. Move it inside the server handler.',
  },
  {
    pattern: /from\s+['"]uploadthing\/server['"]$/,
    message:
      'Top-level uploadthing/server import in API route. Move it inside the server handler.',
  },
  {
    pattern: /from\s+['"]~\/mcp\/transport['"]$/,
    message:
      'Top-level MCP transport import in API route. Move it inside the server handler.',
  },
]

async function collectRouteFiles(dir: string): Promise<Array<string>> {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const files: Array<string> = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectRouteFiles(fullPath)))
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
        violations.push(
          `${path.relative(process.cwd(), filePath)}:${index + 1} ${rule.message}`,
        )
      }
    }
  }
}

const files = await collectRouteFiles(apiRoutesDir)
await Promise.all(files.map((filePath) => checkFile(filePath)))

if (violations.length > 0) {
  console.error('Found restricted API route imports:\n')
  console.error(violations.join('\n'))
  process.exit(1)
}
