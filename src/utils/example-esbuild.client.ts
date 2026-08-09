import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { notebookImports } from './notebook-environment'
import {
  normalizeExamplePath,
  type ExampleWorkspace,
} from './example-workspace'

export type CompiledExampleWorkspace = {
  css: string
  imports: Record<string, string>
  javascript: string
}

const workspaceNamespace = 'tanstack-example-workspace'
const sourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json']
const indexFiles = sourceExtensions.map((extension) => `/index${extension}`)
let esbuildInitialization: Promise<void> | undefined

export async function compileExampleWorkspace(
  workspace: ExampleWorkspace,
): Promise<CompiledExampleWorkspace> {
  esbuildInitialization ??= esbuild.initialize({ wasmURL: esbuildWasmUrl })
  await esbuildInitialization

  const files = normalizeFiles(workspace.files)
  const entry = resolveWorkspacePath(
    normalizeExamplePath(workspace.entry),
    files,
  )

  if (!entry) {
    throw new Error(`Entry file not found: ${workspace.entry}`)
  }

  const result = await esbuild.build({
    absWorkingDir: '/',
    bundle: true,
    entryPoints: [entry],
    format: 'esm',
    jsx: 'automatic',
    jsxImportSource: 'react',
    legalComments: 'none',
    logLevel: 'silent',
    outdir: '/out',
    platform: 'browser',
    plugins: [createWorkspacePlugin(files)],
    sourcemap: 'inline',
    target: 'es2022',
    write: false,
  })

  let css = ''
  let javascript = ''

  for (const output of result.outputFiles) {
    if (output.path.endsWith('.css')) css += output.text
    if (output.path.endsWith('.js')) javascript += output.text
  }

  if (!javascript) {
    throw new Error('esbuild did not produce a JavaScript module')
  }

  return {
    css,
    imports: getWorkspaceImports(workspace, files),
    javascript,
  }
}

function createWorkspacePlugin(files: Record<string, string>): esbuild.Plugin {
  return {
    name: workspaceNamespace,
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('https://') || isBareSpecifier(args.path)) {
          return { external: true, path: args.path }
        }

        const unresolvedPath =
          args.kind === 'entry-point'
            ? normalizeExamplePath(args.path)
            : resolveRelativePath(args.importer, args.path)
        const path = resolveWorkspacePath(unresolvedPath, files)

        if (!path) {
          return {
            errors: [
              {
                text: `Could not resolve ${args.path} from ${args.importer || '/'}`,
              },
            ],
          }
        }

        return { namespace: workspaceNamespace, path }
      })

      build.onLoad({ filter: /.*/, namespace: workspaceNamespace }, (args) => {
        const contents = files[args.path]

        if (contents === undefined) {
          return {
            errors: [{ text: `Workspace file not found: ${args.path}` }],
          }
        }

        return {
          contents,
          loader: getLoader(args.path),
          resolveDir: getDirectory(args.path),
        }
      })
    },
  }
}

function normalizeFiles(files: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(files).map(([path, source]) => [
      normalizeExamplePath(path),
      source,
    ]),
  )
}

function resolveRelativePath(importer: string, specifier: string) {
  if (specifier.startsWith('/')) return normalizeExamplePath(specifier)
  return normalizeExamplePath(`${getDirectory(importer)}/${specifier}`)
}

function resolveWorkspacePath(
  requestedPath: string,
  files: Record<string, string>,
) {
  const candidates = [
    requestedPath,
    ...sourceExtensions.map((extension) => `${requestedPath}${extension}`),
    ...indexFiles.map((indexFile) => `${requestedPath}${indexFile}`),
  ]

  return candidates.find((candidate) => files[candidate] !== undefined)
}

function getDirectory(path: string) {
  const slashIndex = path.lastIndexOf('/')
  return slashIndex <= 0 ? '/' : path.slice(0, slashIndex)
}

function isBareSpecifier(specifier: string) {
  return !specifier.startsWith('.') && !specifier.startsWith('/')
}

function getLoader(path: string): esbuild.Loader {
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (isDataUrlAsset(path)) return 'dataurl'
  return 'js'
}

function isDataUrlAsset(path: string) {
  return /\.(?:avif|gif|jpe?g|png|svg|webp|woff2?)$/i.test(path)
}

function getWorkspaceImports(
  workspace: ExampleWorkspace,
  files: Record<string, string>,
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

  if (!isRecord(packageValue) || !isRecord(packageValue.dependencies)) {
    return { ...imports, ...workspace.imports }
  }

  for (const [name, version] of Object.entries(packageValue.dependencies)) {
    if (typeof version !== 'string') continue
    imports[name] = `https://esm.sh/${name}@${version}`
    imports[`${name}/`] = `https://esm.sh/${name}@${version}/`
  }

  return { ...imports, ...workspace.imports }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
