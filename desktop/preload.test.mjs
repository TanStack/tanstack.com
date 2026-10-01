import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('./preload.cjs', import.meta.url), 'utf8')
function exposed(argv) {
  const bridges = []
  vm.runInNewContext(source, {
    process: { platform: 'darwin', argv },
    window: { addEventListener() {} },
    require: () => ({
      contextBridge: { exposeInMainWorld: (name) => bridges.push(name) },
      ipcRenderer: {},
    }),
  })
  return bridges
}
test('authentication windows receive no native bridge', () => {
  assert.deepEqual(exposed(['electron', '--kody-auth-window']), [])
  assert.deepEqual(exposed(['electron']), ['gumDesktop'])
})
