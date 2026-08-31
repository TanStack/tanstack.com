import ts from 'typescript'
import type { BuilderAiExecution } from '../../src/utils/builder-ai'
import type {
  BuilderAiEvalCheckResult,
  BuilderAiEvalWorkspaceCheck,
} from './types'

export function gradeBuilderAiWorkspace(
  execution: BuilderAiExecution,
  checks: ReadonlyArray<BuilderAiEvalWorkspaceCheck>,
) {
  return checks.map((check): BuilderAiEvalCheckResult => {
    switch (check.kind) {
      case 'runtime': {
        const actual = execution.runtime?.type ?? 'client'
        return result(
          check.description,
          actual === check.runtime,
          `expected ${check.runtime}; received ${actual}`,
        )
      }
      case 'module': {
        const matches = findModuleImports(execution, check.specifier)
        return result(
          check.description,
          matches.length > 0,
          matches.length
            ? `imported by ${matches.join(', ')}`
            : `no static import matched ${check.specifier}`,
        )
      }
      case 'source': {
        const entries = Object.entries(execution.workspace.files).filter(
          ([path]) => !check.path || path === check.path,
        )
        const source = entries
          .map(([path, content]) => `// ${path}\n${content}`)
          .join('\n')
        check.pattern.lastIndex = 0
        const matched = check.pattern.test(source)
        const passed = check.negate ? !matched : matched
        return result(
          check.description,
          passed,
          `${check.negate ? 'forbidden' : 'required'} pattern ${check.pattern} ${matched ? 'matched' : 'did not match'}`,
        )
      }
      case 'call': {
        const matches = findCalls(execution, check.callee, check.path)
        const matched = matches.length > 0
        const passed = check.negate ? !matched : matched
        return result(
          check.description,
          passed,
          `${check.negate ? 'forbidden' : 'required'} call ${check.callee}(...) ${matched ? `appeared in ${matches.join(', ')}` : 'did not appear'}`,
        )
      }
      case 'file': {
        const exists =
          execution.workspace.files[check.path] !== undefined ||
          execution.workspace.binaryFiles?.[check.path] !== undefined
        return result(
          check.description,
          exists,
          exists ? `${check.path} exists` : `${check.path} is missing`,
        )
      }
      case 'dependency': {
        const version = readDependencyVersion(execution, check.packageName)
        return result(
          check.description,
          version !== undefined,
          version
            ? `${check.packageName}@${version}`
            : `${check.packageName} is not in package.json`,
        )
      }
    }
  })
}

export function findModuleImports(
  execution: BuilderAiExecution,
  specifier: string,
) {
  const paths: Array<string> = []
  for (const [path, source] of Object.entries(execution.workspace.files)) {
    if (!isSourceFile(path)) continue
    const imports = ts.preProcessFile(source, true, true).importedFiles
    if (
      imports.some(
        ({ fileName }) =>
          fileName === specifier || fileName.startsWith(`${specifier}/`),
      )
    ) {
      paths.push(path)
    }
  }
  return paths
}

export function findCalls(
  execution: BuilderAiExecution,
  callee: string,
  requiredPath?: string,
) {
  const paths: Array<string> = []
  for (const [path, source] of Object.entries(execution.workspace.files)) {
    if (!isSourceFile(path) || (requiredPath && path !== requiredPath)) continue
    const sourceFile = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      sourceFileKind(path),
    )
    let found = false
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && callName(node.expression) === callee) {
        found = true
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    if (found) paths.push(path)
  }
  return paths
}

function readDependencyVersion(
  execution: BuilderAiExecution,
  packageName: string,
) {
  const source = execution.workspace.files['/package.json']
  if (!source) return undefined
  try {
    const manifest: unknown = JSON.parse(source)
    if (!isRecord(manifest)) return undefined
    for (const section of ['dependencies', 'devDependencies']) {
      const dependencies = manifest[section]
      if (!isRecord(dependencies)) continue
      const version = dependencies[packageName]
      if (typeof version === 'string' && version) return version
    }
  } catch {
    return undefined
  }
  return undefined
}

function isSourceFile(path: string) {
  return /\.[cm]?[jt]sx?$/.test(path)
}

function sourceFileKind(path: string) {
  if (/\.tsx$/.test(path)) return ts.ScriptKind.TSX
  if (/\.jsx$/.test(path)) return ts.ScriptKind.JSX
  if (/\.[cm]?ts$/.test(path)) return ts.ScriptKind.TS
  return ts.ScriptKind.JS
}

function callName(expression: ts.LeftHandSideExpression) {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function result(
  description: string,
  passed: boolean,
  evidence: string,
): BuilderAiEvalCheckResult {
  return { description, passed, evidence }
}
