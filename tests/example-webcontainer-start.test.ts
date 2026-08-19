import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { describe, test } from 'node:test'
import { fromCrossJSON, toCrossJSONAsync } from 'seroval'
import { transformWithOxc } from 'vite'
import { mergeConfig } from 'vite'
import {
  getTanStackStartOxcRuntimeSpecifier,
  getWebContainerStartCommand,
  prepareTanStackStartWebContainerFiles,
  tanStackStartAsyncContextPluginSource,
  tanStackStartViteConfigPath,
} from '../src/utils/example-webcontainer-start'
import type { ExampleRuntime } from '../src/utils/example-workspace'

const startRuntime: ExampleRuntime = {
  type: 'webcontainer',
  compatibility: 'tanstack-start-async-context',
  install: { command: 'pnpm', args: ['install'] },
  start: { command: 'pnpm', args: ['run', 'dev'] },
}

describe('TanStack Start WebContainer compatibility', () => {
  test('aligns the Oxc helper runtime with Rolldown', () => {
    assert.equal(
      getTanStackStartOxcRuntimeSpecifier(
        JSON.stringify({
          dependencies: { '@oxc-project/types': '=0.133.0' },
        }),
      ),
      '@oxc-project/runtime@0.133.0',
    )
    assert.throws(() =>
      getTanStackStartOxcRuntimeSpecifier(JSON.stringify({ dependencies: {} })),
    )
  })

  test('mounts a hidden wrapper without changing the authored Vite config', () => {
    const authoredConfig = `export default { plugins: [{ name: 'authored' }] }`
    const files = prepareTanStackStartWebContainerFiles(
      {
        '/package.json': '{}',
        '/vite.config.ts': authoredConfig,
      },
      startRuntime,
    )

    assert.equal(files['/vite.config.ts'], authoredConfig)
    assert.match(
      files[tanStackStartViteConfigPath] ?? '',
      /import authoredConfig from "\.\.\/vite\.config\.ts"/,
    )
    assert.match(
      files[tanStackStartViteConfigPath] ?? '',
      /plugins: \[tanStackStartAsyncContextPlugin\(\)\]/,
    )
    assert.match(
      files[tanStackStartViteConfigPath] ?? '',
      /"@tanstack\/start\*\*"/,
    )
    assert.equal(
      files['/.tanstack/async-context-plugin.mjs'],
      tanStackStartAsyncContextPluginSource,
    )
  })

  test('starts Vite with the hidden config only for the Start profile', () => {
    assert.deepEqual(getWebContainerStartCommand(startRuntime), {
      command: 'pnpm',
      args: ['run', 'dev', '--', '--config', '.tanstack/vite.config.mjs'],
    })

    assert.deepEqual(
      getWebContainerStartCommand({
        type: 'webcontainer',
        install: { command: 'npm', args: ['install'] },
        start: { command: 'npm', args: ['run', 'dev'] },
      }),
      { command: 'npm', args: ['run', 'dev'] },
    )
  })

  test('rejects unsupported Start configs and commands instead of guessing', () => {
    assert.throws(() =>
      prepareTanStackStartWebContainerFiles(
        { '/package.json': '{}' },
        startRuntime,
      ),
    )
    assert.throws(() =>
      prepareTanStackStartWebContainerFiles(
        {
          '/vite.config.ts': 'export default {}',
          [tanStackStartViteConfigPath]: 'reserved',
        },
        startRuntime,
      ),
    )
    assert.throws(() =>
      getWebContainerStartCommand({
        ...startRuntime,
        start: { command: 'vite', args: ['dev'] },
      }),
    )
  })

  test('runs after authored plugins and only transforms server modules', async () => {
    const merged = mergeConfig(
      { plugins: [{ name: 'authored' }] },
      {
        plugins: [
          {
            name: 'tanstack:webcontainer-start-async-context',
            enforce: 'post',
          },
        ],
      },
    )
    assert.deepEqual(merged.plugins, [
      { name: 'authored' },
      {
        name: 'tanstack:webcontainer-start-async-context',
        enforce: 'post',
      },
    ])

    const calls: Array<{
      code: string
      filename: string
      options: Record<string, unknown>
    }> = []
    const callsKey = `__tanstack_async_transform_calls_${Date.now()}`
    Reflect.set(globalThis, callsKey, calls)

    const executableSource = tanStackStartAsyncContextPluginSource.replace(
      `import { transformWithOxc } from 'vite'`,
      `const transformWithOxc = async (code, filename, options) => {
        globalThis[${JSON.stringify(callsKey)}].push({ code, filename, options })
        return {
          code: 'import helper from "@oxc-project/runtime/helpers/wrapAsyncGenerator"\\nlowered',
          map: { mappings: '' },
        }
      }`,
    )

    try {
      const moduleUrl = `data:text/javascript;base64,${Buffer.from(executableSource).toString('base64')}`
      const pluginModule = await import(moduleUrl)
      const plugin = pluginModule.tanStackStartAsyncContextPlugin()
      const serverContext = {
        environment: { config: { consumer: 'server' } },
      }
      const clientContext = {
        environment: { config: { consumer: 'client' } },
      }

      assert.equal(
        plugin.resolveId.handler.call(
          serverContext,
          pluginModule.serializableAsyncGeneratorRuntimeSpecifier,
          '/src/server.ts',
          {},
        ),
        pluginModule.serializableAsyncGeneratorRuntimeId,
      )
      assert.equal(
        plugin.resolveId.handler.call(
          clientContext,
          pluginModule.serializableAsyncGeneratorRuntimeSpecifier,
          '/src/client.ts',
          {},
        ),
        pluginModule.serializableAsyncGeneratorRuntimeId,
      )
      assert.equal(
        plugin.resolveId.handler.call(
          serverContext,
          pluginModule.oxcAsyncGeneratorRuntimeId,
          pluginModule.serializableAsyncGeneratorRuntimeId,
          {},
        ),
        undefined,
      )
      assert.match(
        plugin.load(pluginModule.serializableAsyncGeneratorRuntimeId),
        /Object\.defineProperty\(iterator, '_invoke', \{ enumerable: false \}\)/,
      )
      assert.equal(plugin.resolveId.order, 'pre')

      const clientResult = await plugin.transform.handler.call(
        clientContext,
        'export async function client() {}',
        '/src/client.ts',
        {},
      )
      assert.equal(clientResult, undefined)

      const serverResult = await plugin.transform.handler.call(
        serverContext,
        'export async function server() { await work() }',
        '/src/server.ts',
        {},
      )
      assert.deepEqual(serverResult, {
        code: 'import helper from "virtual:tanstack-webcontainer-serializable-async-generator"\nlowered',
        map: { mappings: '' },
      })
      assert.equal(calls.length, 1)
      assert.equal(calls[0]?.filename, '/src/server.ts')
      assert.deepEqual(calls[0]?.options, {
        target: 'es2016',
        sourcemap: true,
      })
    } finally {
      Reflect.deleteProperty(globalThis, callsKey)
    }
  })

  test('keeps lowered async generators serializable without changing their behavior', async () => {
    const executableSource = tanStackStartAsyncContextPluginSource.replace(
      `import { transformWithOxc } from 'vite'`,
      `const transformWithOxc = () => { throw new Error('Unexpected transform') }`,
    )
    const pluginUrl = `data:text/javascript;base64,${Buffer.from(executableSource).toString('base64')}`
    const pluginModule = await import(pluginUrl)
    const plugin = pluginModule.tanStackStartAsyncContextPlugin()
    const helperSource = plugin.load(
      pluginModule.serializableAsyncGeneratorRuntimeId,
    )
    const helperExecutableSource = helperSource.replace(
      `import wrapAsyncGenerator from ${JSON.stringify(pluginModule.oxcAsyncGeneratorRuntimeId)}`,
      `const wrapAsyncGenerator = (generator) => function () {
        const iterator = generator.apply(this, arguments)
        Object.defineProperty(iterator, '_invoke', {
          configurable: true,
          enumerable: true,
          value() {},
          writable: true,
        })
        return iterator
      }`,
    )
    const helperUrl = `data:text/javascript;base64,${Buffer.from(helperExecutableSource).toString('base64')}`
    const helperModule = await import(helperUrl)
    const createIterator = helperModule.default(async function* () {
      yield 1
      await Promise.resolve()
      yield 2
    })
    const iterator = createIterator()

    assert.equal(typeof iterator._invoke, 'function')
    assert.equal(
      Object.prototype.propertyIsEnumerable.call(iterator, '_invoke'),
      false,
    )
    assert.equal(iterator[Symbol.asyncIterator](), iterator)

    const serialized = await toCrossJSONAsync(iterator)
    const restored = fromCrossJSON<AsyncIterable<number>>(serialized, {})
    const values: Array<number> = []
    for await (const value of restored) values.push(value)

    assert.deepEqual(values, [1, 2])
  })

  test('ES2016 lowering preserves concurrent continuation context', async () => {
    const source = `
      globalThis.runRequest = async function runRequest(storage, value, gate) {
        return storage.run(value, async () => {
          await gate
          return storage.getStore()
        })
      }
    `
    const result = await transformWithOxc(source, '/request.js', {
      target: 'es2016',
    })

    assert.doesNotMatch(result.code, /async function runRequest/)

    const requestResults = runInNewContext(`
      let currentContext

      class ContextPromise extends Promise {
        then(onFulfilled, onRejected) {
          const capturedContext = currentContext
          const wrap = (callback) =>
            typeof callback !== 'function'
              ? callback
              : (value) => {
                  const previousContext = currentContext
                  currentContext = capturedContext
                  try {
                    return callback(value)
                  } finally {
                    currentContext = previousContext
                  }
                }
          return super.then(wrap(onFulfilled), wrap(onRejected))
        }
      }

      globalThis.Promise = ContextPromise
      const storage = {
        run(value, callback) {
          const previousContext = currentContext
          currentContext = value
          try {
            return callback()
          } finally {
            currentContext = previousContext
          }
        },
        getStore() {
          return currentContext
        },
      }
      const deferred = () => {
        let resolve
        const promise = new Promise((next) => { resolve = next })
        return { promise, resolve }
      }

      const require = (specifier) => {
        if (specifier !== '@oxc-project/runtime/helpers/asyncToGenerator') {
          throw new Error('Unexpected helper: ' + specifier)
        }

        return (generator) => function (...args) {
          const self = this
          return new Promise((resolve, reject) => {
            const iterator = generator.apply(self, args)
            const step = (method, value) => {
              let result
              try {
                result = iterator[method](value)
              } catch (error) {
                reject(error)
                return
              }
              if (result.done) {
                resolve(result.value)
                return
              }
              Promise.resolve(result.value).then(
                (next) => step('next', next),
                (error) => step('throw', error),
              )
            }
            step('next')
          })
        }
      }

      ${result.code}

      const firstGate = deferred()
      const secondGate = deferred()
      const first = runRequest(storage, 'first', firstGate.promise)
      const second = runRequest(storage, 'second', secondGate.promise)
      secondGate.resolve()
      firstGate.resolve()
      Promise.all([first, second]).then((values) => values.join(','))
    `)

    assert.equal(await requestResults, 'first,second')
  })

  test('lowered async generators preserve concurrent context after await', async () => {
    const source = `
      globalThis.runStreamRequest = function runStreamRequest(
        storage,
        value,
        gate,
      ) {
        const iterator = (async function* () {
          await gate
          yield storage.getStore()
        })()
        return storage.run(value, () => iterator.next())
      }
    `
    const result = await transformWithOxc(source, '/stream.js', {
      target: 'es2016',
    })

    assert.match(result.code, /helpers\/wrapAsyncGenerator/)
    assert.doesNotMatch(result.code, /async function\*/)

    const requestResults = runInNewContext(`
      let currentContext

      class ContextPromise extends Promise {
        then(onFulfilled, onRejected) {
          const capturedContext = currentContext
          const wrap = (callback) =>
            typeof callback !== 'function'
              ? callback
              : (value) => {
                  const previousContext = currentContext
                  currentContext = capturedContext
                  try {
                    return callback(value)
                  } finally {
                    currentContext = previousContext
                  }
                }
          return super.then(wrap(onFulfilled), wrap(onRejected))
        }
      }

      globalThis.Promise = ContextPromise
      const storage = {
        run(value, callback) {
          const previousContext = currentContext
          currentContext = value
          try {
            return callback()
          } finally {
            currentContext = previousContext
          }
        },
        getStore() {
          return currentContext
        },
      }
      const deferred = () => {
        let resolve
        const promise = new Promise((next) => { resolve = next })
        return { promise, resolve }
      }

      function OverloadYield(value, kind) {
        this.v = value
        this.k = kind
      }

      const awaitAsyncGenerator = (value) => new OverloadYield(value, 0)

      function AsyncGenerator(iterator) {
        let front
        let back

        const resume = (method, value) => {
          try {
            const result = iterator[method](value)
            const yielded = result.value
            const overloaded = yielded instanceof OverloadYield
            Promise.resolve(overloaded ? yielded.v : yielded).then(
              (resolved) => {
                if (overloaded) {
                  const nextMethod = method === 'return' ? 'return' : 'next'
                  if (!yielded.k || resolved.done) {
                    resume(nextMethod, resolved)
                    return
                  }
                  value = iterator[nextMethod](resolved).value
                }
                settle(result.done ? 'return' : 'normal', resolved)
              },
              (error) => resume('throw', error),
            )
          } catch (error) {
            settle('throw', error)
          }
        }

        const settle = (type, value) => {
          if (type === 'return') {
            front.resolve({ value, done: true })
          } else if (type === 'throw') {
            front.reject(value)
          } else {
            front.resolve({ value, done: false })
          }
          front = front.next
          if (front) {
            resume(front.key, front.arg)
          } else {
            back = undefined
          }
        }

        this._invoke = (key, arg) =>
          new Promise((resolve, reject) => {
            const request = { key, arg, resolve, reject, next: undefined }
            if (back) {
              back = back.next = request
            } else {
              front = back = request
              resume(key, arg)
            }
          })
        if (typeof iterator.return !== 'function') this.return = undefined
      }

      AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
        return this
      }
      AsyncGenerator.prototype.next = function (value) {
        return this._invoke('next', value)
      }
      AsyncGenerator.prototype.throw = function (value) {
        return this._invoke('throw', value)
      }
      AsyncGenerator.prototype.return = function (value) {
        return this._invoke('return', value)
      }

      const wrapAsyncGenerator = (generator) => function (...args) {
        const iterator = new AsyncGenerator(generator.apply(this, args))
        Object.defineProperty(iterator, '_invoke', { enumerable: false })
        return iterator
      }

      const require = (specifier) => {
        if (specifier.endsWith('/awaitAsyncGenerator')) {
          return awaitAsyncGenerator
        }
        if (specifier.endsWith('/wrapAsyncGenerator')) {
          return wrapAsyncGenerator
        }
        throw new Error('Unexpected helper: ' + specifier)
      }

      ${result.code}

      const firstGate = deferred()
      const secondGate = deferred()
      const first = runStreamRequest(storage, 'first', firstGate.promise)
      const second = runStreamRequest(storage, 'second', secondGate.promise)
      secondGate.resolve()
      firstGate.resolve()
      Promise.all([first, second]).then((values) =>
        values.map((value) => value.value).join(','),
      )
    `)

    assert.equal(await requestResults, 'first,second')
  })
})
