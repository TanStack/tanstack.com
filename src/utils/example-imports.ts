import { notebookImports } from './notebook-environment'
import type { ExampleWorkspace } from './example-workspace'

export function getExampleWorkspaceImports(
  workspace: ExampleWorkspace,
  files: Record<string, string>,
  externalSpecifiers: ReadonlySet<string> = new Set(),
) {
  const imports: Record<string, string> = { ...notebookImports }
  const packageSource = files['/package.json']

  if (!packageSource) return { ...imports, ...workspace.imports }

  let packageValue: unknown
  try {
    packageValue = JSON.parse(packageSource)
  } catch {
    throw new Error('Invalid /package.json')
  }

  if (!isRecord(packageValue)) {
    return { ...imports, ...workspace.imports }
  }

  const dependencies = getPackageVersions(packageValue.dependencies)
  const devDependencies = getPackageVersions(packageValue.devDependencies)
  const packageVersions = new Map([...devDependencies, ...dependencies])
  const importedPackages = [...packageVersions].filter(([name]) =>
    isPackageImported(name, externalSpecifiers),
  )
  const hasReact = packageVersions.has('react')

  for (const [name, version] of importedPackages) {
    removePackageImports(imports, name)

    const packageUrl = `https://esm.sh/${name}@${version}`
    imports[name] = `${packageUrl}${getPackageExternalQuery(name, hasReact)}`
    imports[`${name}/`] = `${packageUrl}/`

    if (name === 'react') {
      imports['react/jsx-dev-runtime'] = `${packageUrl}/jsx-dev-runtime`
      imports['react/jsx-runtime'] = `${packageUrl}/jsx-runtime`
    }

    if (name === 'react-dom') {
      imports['react-dom/client'] = `${packageUrl}/client?external=react`
    }
  }

  for (const specifier of externalSpecifiers) {
    const dependency = importedPackages.find(([name]) =>
      specifier.startsWith(`${name}/`),
    )
    if (!dependency) continue

    const [name, version] = dependency
    const subpath = specifier.slice(name.length + 1)
    const url = `https://esm.sh/${name}@${version}/${subpath}`
    imports[specifier] = appendQuery(
      url,
      getPackageExternalQuery(name, hasReact),
    )
  }

  return { ...imports, ...workspace.imports }
}

function getPackageVersions(value: unknown) {
  if (!isRecord(value)) return []

  return Object.entries(value).filter(
    (dependency): dependency is [string, string] =>
      typeof dependency[1] === 'string',
  )
}

function isPackageImported(
  name: string,
  externalSpecifiers: ReadonlySet<string>,
) {
  for (const specifier of externalSpecifiers) {
    if (specifier === name || specifier.startsWith(`${name}/`)) return true
  }

  return false
}

function removePackageImports(imports: Record<string, string>, name: string) {
  for (const specifier of Object.keys(imports)) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      delete imports[specifier]
    }
  }
}

function getPackageExternalQuery(name: string, hasReact: boolean) {
  if (!hasReact || name === 'react') return ''
  if (name === 'react-dom') return '?external=react'
  return '?external=react,react-dom'
}

function appendQuery(url: string, query: string) {
  if (!query) return url
  return `${url}${url.includes('?') ? '&' : '?'}${query.slice(1)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
