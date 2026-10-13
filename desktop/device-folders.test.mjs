import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtemp,
  realpath,
  stat,
  writeFile,
  symlink,
  rm,
  mkdir,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readGrantedFolder } from './device-folders.mjs'
test('folder grants read text, reject escapes and revoked access', async () => {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'banks-device-')))
  try {
    await writeFile(join(path, 'note.txt'), 'A device note')
    await symlink('/etc', join(path, 'escape'))
    await mkdir(join(path, 'nested'))
    await writeFile(join(path, 'nested', 'ok.txt'), 'nested')
    const info = await stat(path),
      grants = [{ id: 'folder', path, dev: info.dev, ino: info.ino }]
    const request = { grantId: 'folder', operation: 'read', path: 'note.txt' }
    assert.deepEqual(await readGrantedFolder(grants, request), {
      text: 'A device note',
    })
    assert.deepEqual(
      await readGrantedFolder(grants, { ...request, path: 'nested/ok.txt' }),
      { text: 'nested' },
    )
    assert.equal(
      (
        await readGrantedFolder(grants, {
          ...request,
          operation: 'list',
          path: '',
        })
      ).entries.length,
      3,
    )
    await assert.rejects(
      readGrantedFolder(grants, { ...request, path: '../other' }),
    )
    await assert.rejects(
      readGrantedFolder(grants, { ...request, path: 'escape/passwd' }),
    )
    await assert.rejects(readGrantedFolder([], request))
    await assert.rejects(
      readGrantedFolder([{ ...grants[0], ino: -1 }], request),
    )
    await writeFile(join(path, 'large.txt'), 'x'.repeat(65537))
    await assert.rejects(
      readGrantedFolder(grants, { ...request, path: 'large.txt' }),
    )
  } finally {
    await rm(path, { recursive: true, force: true })
  }
})
