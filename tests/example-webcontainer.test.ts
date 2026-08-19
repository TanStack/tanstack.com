import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  connectWebContainerTerminalProcess,
  createWebContainerExampleSession,
  createWebContainerFileSystemTree,
  getExampleWebContainerSupport,
} from '../src/utils/example-webcontainer.client'

describe('WebContainer example runtime', () => {
  test('creates a nested mount tree from canonical workspace paths', () => {
    assert.deepEqual(
      createWebContainerFileSystemTree({
        '/package.json': '{"scripts":{"dev":"vite"}}',
        '/src/routes/index.tsx': 'export const Route = null',
        '/src/router.tsx': 'export const router = null',
      }),
      {
        'package.json': {
          file: { contents: '{"scripts":{"dev":"vite"}}' },
        },
        src: {
          directory: {
            'router.tsx': {
              file: { contents: 'export const router = null' },
            },
            routes: {
              directory: {
                'index.tsx': {
                  file: { contents: 'export const Route = null' },
                },
              },
            },
          },
        },
      },
    )
  })

  test('decodes encoded binary assets into exact mount bytes', () => {
    assert.deepEqual(
      createWebContainerFileSystemTree(
        {
          '/src/main.ts': 'export {}',
        },
        {
          '/public/favicon.ico': 'AAECA/8=',
        },
      ),
      {
        public: {
          directory: {
            'favicon.ico': {
              file: { contents: new Uint8Array([0, 1, 2, 3, 255]) },
            },
          },
        },
        src: {
          directory: {
            'main.ts': { file: { contents: 'export {}' } },
          },
        },
      },
    )
  })

  test('rejects invalid and conflicting workspace paths', () => {
    assert.throws(() =>
      createWebContainerFileSystemTree({
        'src/index.ts': '',
      }),
    )
    assert.throws(() =>
      createWebContainerFileSystemTree({
        '/src': '',
        '/src/index.ts': '',
      }),
    )
  })

  test('reports server rendering as unsupported', () => {
    assert.deepEqual(getExampleWebContainerSupport(), {
      supported: false,
      reason: 'WebContainer requires a browser.',
    })
  })

  test('preserves opt-in runtime compatibility metadata', () => {
    const session = createWebContainerExampleSession({
      onEvent: () => {},
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'npm', args: ['install'] },
        start: { command: 'npm', args: ['run', 'dev'] },
      },
      workspace: {
        version: 1,
        entry: '/src/main.ts',
        files: { '/src/main.ts': '' },
      },
    })

    assert.deepEqual(Reflect.get(session, 'runtime'), {
      type: 'webcontainer',
      compatibility: 'tanstack-start-async-context',
      install: { command: 'npm', args: ['install'] },
      start: { command: 'npm', args: ['run', 'dev'] },
    })
  })

  test('installs the Start compatibility runtime with pnpm', async () => {
    const reads: Array<[string, string]> = []
    const spawns: Array<[string, Array<string>]> = []
    const session = createWebContainerExampleSession({
      onEvent: () => {},
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      workspace: {
        version: 1,
        entry: '/src/main.ts',
        files: { '/src/main.ts': '' },
      },
    })
    Reflect.set(session, 'container', {
      fs: {
        readFile(path: string, encoding: string) {
          reads.push([path, encoding])
          return Promise.resolve(
            JSON.stringify({
              dependencies: { '@oxc-project/types': '=0.144.0' },
            }),
          )
        },
      },
      spawn(command: string, args: Array<string>) {
        spawns.push([command, args])
        return Promise.resolve({
          exit: Promise.resolve(0),
          output: new ReadableStream<string>({
            start(controller) {
              controller.close()
            },
          }),
        })
      },
    })

    await Reflect.get(session, 'installCompatibilityDependencies').call(session)

    assert.deepEqual(reads, [
      ['node_modules/.pnpm/node_modules/rolldown/package.json', 'utf-8'],
    ])
    assert.deepEqual(spawns, [
      [
        'pnpm',
        [
          'add',
          '--save-dev',
          '--lockfile=false',
          '@oxc-project/runtime@0.144.0',
        ],
      ],
    ])
  })

  test('connects terminal output, input, and resizing to a process', async () => {
    const inputs: Array<string> = []
    const outputs: Array<string> = []
    const errors: Array<unknown> = []
    const resizes: Array<{ cols: number; rows: number }> = []
    let killed = 0
    let outputController: ReadableStreamDefaultController<string> | undefined
    const process = {
      exit: new Promise<number>(() => {}),
      input: new WritableStream<string>({
        write(value) {
          inputs.push(value)
        },
      }),
      kill() {
        killed += 1
      },
      output: new ReadableStream<string>({
        start(controller) {
          outputController = controller
        },
      }),
      resize(dimensions: { cols: number; rows: number }) {
        resizes.push(dimensions)
      },
    }
    const terminal = connectWebContainerTerminalProcess({
      onError: (cause) => errors.push(cause),
      onExit: () => {},
      onOutput: (value) => outputs.push(value),
      process,
    })

    assert.ok(outputController)
    outputController.enqueue('ready\r\n')
    await waitForStreams()
    await terminal.write('pwd\r')
    terminal.resize({ cols: 92, rows: 28 })
    terminal.dispose()
    terminal.dispose()
    await waitForStreams()

    assert.deepEqual(outputs, ['ready\r\n'])
    assert.deepEqual(inputs, ['pwd\r'])
    assert.deepEqual(resizes, [{ cols: 92, rows: 28 }])
    assert.deepEqual(errors, [])
    assert.equal(killed, 1)
  })

  test('reports a natural shell exit without killing it again', async () => {
    const exits: Array<number> = []
    let killed = 0
    let resolveExit = (_exitCode: number) => {}
    let outputController: ReadableStreamDefaultController<string> | undefined
    const exit = new Promise<number>((resolve) => {
      resolveExit = resolve
    })
    const terminal = connectWebContainerTerminalProcess({
      onError: () => {},
      onExit: (exitCode) => exits.push(exitCode),
      onOutput: () => {},
      process: {
        exit,
        input: new WritableStream<string>(),
        kill() {
          killed += 1
        },
        output: new ReadableStream<string>({
          start(controller) {
            outputController = controller
          },
        }),
        resize() {},
      },
    })

    assert.ok(outputController)
    outputController.close()
    resolveExit(0)
    await waitForStreams()
    terminal.dispose()

    assert.deepEqual(exits, [0])
    assert.equal(killed, 0)
  })

  test('drains final terminal output before reporting a natural exit', async () => {
    const events: Array<string> = []
    let resolveExit = (_exitCode: number) => {}
    let outputController: ReadableStreamDefaultController<string> | undefined
    const exit = new Promise<number>((resolve) => {
      resolveExit = resolve
    })
    connectWebContainerTerminalProcess({
      onError: () => {},
      onExit: () => events.push('exit'),
      onOutput: (value) => events.push(value),
      process: {
        exit,
        input: new WritableStream<string>(),
        kill() {},
        output: new ReadableStream<string>({
          start(controller) {
            outputController = controller
          },
        }),
        resize() {},
      },
    })

    assert.ok(outputController)
    resolveExit(0)
    outputController.enqueue('final output\r\n')
    outputController.close()
    await waitForStreams()

    assert.deepEqual(events, ['final output\r\n', 'exit'])
  })

  test('reports unexpected terminal exits and ignores disposal aborts', async () => {
    const errors: Array<unknown> = []
    const exits: Array<number> = []
    let killed = 0
    let rejectExit = (_cause: unknown) => {}
    const exit = new Promise<number>((_, reject) => {
      rejectExit = reject
    })
    const terminal = connectWebContainerTerminalProcess({
      onError: (cause) => errors.push(cause),
      onExit: (exitCode) => exits.push(exitCode),
      onOutput: () => {},
      process: {
        exit,
        input: new WritableStream<string>(),
        kill() {
          killed += 1
        },
        output: new ReadableStream<string>(),
        resize() {},
      },
    })
    const exitError = new Error('Terminal process failed.')

    rejectExit(exitError)
    await waitForStreams()
    terminal.dispose()

    assert.deepEqual(errors, [exitError])
    assert.deepEqual(exits, [])
    assert.equal(killed, 0)

    const disposedErrors: Array<unknown> = []
    let disposedKilled = 0
    let rejectDisposedExit = (_cause: unknown) => {}
    const disposedExit = new Promise<number>((_, reject) => {
      rejectDisposedExit = reject
    })
    const disposedTerminal = connectWebContainerTerminalProcess({
      onError: (cause) => disposedErrors.push(cause),
      onExit: () => {},
      onOutput: () => {},
      process: {
        exit: disposedExit,
        input: new WritableStream<string>(),
        kill() {
          disposedKilled += 1
        },
        output: new ReadableStream<string>(),
        resize() {},
      },
    })

    disposedTerminal.dispose()
    rejectDisposedExit(new Error('Process aborted'))
    await waitForStreams()

    assert.deepEqual(disposedErrors, [])
    assert.equal(disposedKilled, 1)
  })

  test('keeps sibling terminals alive together and disposes all with the session', async () => {
    const inputs: Array<Array<string>> = [[], []]
    const killed = [0, 0]
    let spawnCount = 0
    let teardownCount = 0
    const processes = inputs.map((processInputs, index) => ({
      exit: new Promise<number>(() => {}),
      input: new WritableStream<string>({
        write(value) {
          processInputs.push(value)
        },
      }),
      kill() {
        killed[index] += 1
      },
      output: new ReadableStream<string>(),
      resize() {},
    }))
    const session = createWebContainerExampleSession({
      onEvent: () => {},
      runtime: {
        type: 'webcontainer',
        install: { command: 'npm', args: ['install'] },
        start: { command: 'npm', args: ['run', 'dev'] },
      },
      workspace: {
        version: 1,
        entry: '/src/main.ts',
        files: { '/src/main.ts': '' },
      },
    })
    Reflect.set(session, 'startPromise', Promise.resolve())
    Reflect.set(session, 'container', {
      spawn() {
        const process = processes[spawnCount]
        spawnCount += 1
        if (!process) throw new Error('Unexpected terminal process')
        return Promise.resolve(process)
      },
      teardown() {
        teardownCount += 1
      },
    })

    const first = await session.openTerminal({
      cols: 80,
      onError: () => {},
      onExit: () => {},
      onOutput: () => {},
      rows: 24,
    })
    const second = await session.openTerminal({
      cols: 80,
      onError: () => {},
      onExit: () => {},
      onOutput: () => {},
      rows: 24,
    })

    await first.write('first\r')
    await second.write('second\r')
    assert.deepEqual(inputs, [['first\r'], ['second\r']])
    assert.deepEqual(killed, [0, 0])

    first.dispose()
    await second.write('still alive\r')
    assert.deepEqual(inputs, [['first\r'], ['second\r', 'still alive\r']])
    assert.deepEqual(killed, [1, 0])

    session.dispose()
    session.dispose()
    assert.deepEqual(killed, [1, 1])
    assert.equal(teardownCount, 1)
  })
})

function waitForStreams() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
