import { spawnSync } from 'node:child_process'
import { mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
const root = process.cwd()
const directory = mkdtempSync(path.join(tmpdir(), 'tanstack-staging-baseline-'))
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: directory,
    stdio: 'inherit',
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed`)
  return result
}
const archive = run(
  'git',
  ['-C', root, 'archive', '5cd9f45ac1685200fa413e74199392b2c3df23e1'],
  { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 * 1024 * 1024 },
)
run('tar', ['-x', '-C', directory], {
  input: archive.stdout,
  stdio: ['pipe', 'inherit', 'inherit'],
})
run('git', ['apply', path.join(root, 'staging/baseline.patch')])
symlinkSync(
  path.join(root, 'node_modules'),
  path.join(directory, 'node_modules'),
  'dir',
)
run(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'),
  'build',
  '--mode',
  'staging',
])
console.log(`Unified staging build: ${directory}/dist/server/wrangler.json`)
