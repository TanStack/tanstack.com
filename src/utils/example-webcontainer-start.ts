import type { ExampleRuntime } from './example-workspace'

export const tanStackStartAsyncContextCompatibility =
  'tanstack-start-async-context'

export const tanStackStartViteConfigPath = '/.tanstack/vite.config.mjs'

const tanStackStartAsyncContextPluginPath =
  '/.tanstack/async-context-plugin.mjs'

const viteConfigPaths = [
  '/vite.config.ts',
  '/vite.config.mts',
  '/vite.config.js',
  '/vite.config.mjs',
] as const

const tanStackNoExternal = [
  '@tanstack/start**',
  '@tanstack/react-start**',
  '@tanstack/router**',
  '@tanstack/react-router**',
] as const

export function getTanStackStartOxcRuntimeSpecifier(
  rolldownPackageSource: string,
) {
  const packageJson: unknown = JSON.parse(rolldownPackageSource)
  if (!isRecord(packageJson) || !isRecord(packageJson.dependencies)) {
    throw new Error(
      'Could not determine the Oxc runtime version from Rolldown.',
    )
  }

  const typesVersion = packageJson.dependencies['@oxc-project/types']
  if (
    typeof typesVersion !== 'string' ||
    !/^=?\d+\.\d+\.\d+$/.test(typesVersion)
  ) {
    throw new Error(
      'Could not determine the Oxc runtime version from Rolldown.',
    )
  }

  return `@oxc-project/runtime@${typesVersion.replace(/^=/, '')}`
}

export function prepareTanStackStartWebContainerFiles(
  files: Record<string, string>,
  runtime: ExampleRuntime,
): Record<string, string> {
  if (runtime.compatibility !== tanStackStartAsyncContextCompatibility) {
    return { ...files }
  }

  const authoredConfigPath = viteConfigPaths.find(
    (path) => files[path] !== undefined,
  )
  if (!authoredConfigPath) {
    throw new Error(
      'TanStack Start async-context compatibility requires an ESM vite.config file.',
    )
  }

  if (
    files[tanStackStartViteConfigPath] !== undefined ||
    files[tanStackStartAsyncContextPluginPath] !== undefined
  ) {
    throw new Error(
      'The example contains files reserved for the TanStack Start runtime.',
    )
  }

  return {
    ...files,
    [tanStackStartViteConfigPath]: createViteConfigSource(authoredConfigPath),
    [tanStackStartAsyncContextPluginPath]:
      tanStackStartAsyncContextPluginSource,
  }
}

export function getWebContainerStartCommand(runtime: ExampleRuntime) {
  if (runtime.compatibility !== tanStackStartAsyncContextCompatibility) {
    return {
      command: runtime.start.command,
      args: [...runtime.start.args],
    }
  }

  if (
    (runtime.start.command !== 'npm' && runtime.start.command !== 'pnpm') ||
    runtime.start.args[0] !== 'run'
  ) {
    throw new Error(
      'TanStack Start async-context compatibility requires an npm or pnpm run start command.',
    )
  }

  const args = [...runtime.start.args]
  if (!args.includes('--')) args.push('--')
  args.push('--config', tanStackStartViteConfigPath.slice(1))

  return { command: runtime.start.command, args }
}

function createViteConfigSource(authoredConfigPath: string) {
  const authoredConfigImport = `..${authoredConfigPath}`

  return `import authoredConfig from ${JSON.stringify(authoredConfigImport)}
import { defineConfig, mergeConfig } from 'vite'
import { tanStackStartAsyncContextPlugin } from './async-context-plugin.mjs'

const noExternal = ${JSON.stringify(tanStackNoExternal)}

export default defineConfig(async (configEnv) => {
  const resolvedAuthoredConfig =
    typeof authoredConfig === 'function'
      ? await authoredConfig(configEnv)
      : await authoredConfig

  return mergeConfig(resolvedAuthoredConfig, {
    plugins: [tanStackStartAsyncContextPlugin()],
    resolve: { noExternal },
    ssr: { noExternal },
  })
})
`
}

export const tanStackStartAsyncContextPluginSource = `import { transformWithOxc } from 'vite'

const scriptIdPattern = /\\.[cm]?[jt]sx?(?:$|\\?)/
export const oxcAsyncGeneratorRuntimeId =
  '@oxc-project/runtime/helpers/wrapAsyncGenerator'
export const serializableAsyncGeneratorRuntimeSpecifier =
  'virtual:tanstack-webcontainer-serializable-async-generator'
export const serializableAsyncGeneratorRuntimeId =
  '\\0tanstack:webcontainer-serializable-async-generator'

export function tanStackStartAsyncContextPlugin() {
  return {
    name: 'tanstack:webcontainer-start-async-context',
    enforce: 'post',
    resolveId: {
      order: 'pre',
      handler(source) {
        if (source === serializableAsyncGeneratorRuntimeSpecifier) {
          return serializableAsyncGeneratorRuntimeId
        }
      },
    },
    load(id) {
      if (id !== serializableAsyncGeneratorRuntimeId) return

      return \`import wrapAsyncGenerator from \${JSON.stringify(oxcAsyncGeneratorRuntimeId)}

export default function wrapSerializableAsyncGenerator(generator) {
  const createIterator = wrapAsyncGenerator(generator)

  return function () {
    const iterator = createIterator.apply(this, arguments)
    if (Object.prototype.propertyIsEnumerable.call(iterator, '_invoke')) {
      Object.defineProperty(iterator, '_invoke', { enumerable: false })
    }
    return iterator
  }
}
\`
    },
    transform: {
      order: 'post',
      async handler(code, id, options) {
        const environment = this.environment
        const isServer = environment
          ? environment.config.consumer === 'server'
          : options?.ssr === true

        if (
          !isServer ||
          id.includes('/.tanstack/') ||
          (!scriptIdPattern.test(id) &&
            !id.startsWith('virtual:') &&
            !id.startsWith('\\0')) ||
          (!code.includes('async') && !code.includes('await'))
        ) {
          return
        }

        const filename =
          id.startsWith('virtual:') || id.startsWith('\\0')
            ? '/tanstack-start-virtual-module.js'
            : id.split('?')[0]
        const result = await transformWithOxc(code, filename, {
          target: 'es2016',
          sourcemap: true,
        })

        return {
          code: result.code.replaceAll(
            oxcAsyncGeneratorRuntimeId,
            serializableAsyncGeneratorRuntimeSpecifier,
          ),
          map: result.map,
        }
      },
    },
  }
}
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
