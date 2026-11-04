import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
const execute = promisify(execFile)
const helper = fileURLToPath(
  new URL('./native/folder-access', import.meta.url),
).replace('app.asar/', 'app.asar.unpacked/')
export async function readGrantedFolder(grants, request) {
  const grant = grants.find((g) => g.id === request.grantId)
  if (!grant) throw new Error('Folder permission was removed.')
  if (
    !['list', 'read'].includes(request.operation) ||
    typeof request.path !== 'string' ||
    request.path.includes('\0')
  )
    throw new Error('Invalid operation.')
  const { stdout } = await execute(
    helper,
    [
      grant.path,
      String(grant.dev),
      String(grant.ino),
      request.path,
      request.operation,
    ],
    { encoding: 'buffer', maxBuffer: 131072, timeout: 5000 },
  )
  if (request.operation === 'list') {
    const entries = stdout.toString('utf8').split('\0').filter(Boolean)
    return {
      entries: entries.slice(0, 200).map((e) => ({
        name: e.slice(1),
        kind:
          e[0] === 'd' ? 'directory' : e[0] === 'f' ? 'file' : 'unavailable',
      })),
      limited: entries.length > 200,
    }
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(stdout)
  if (text.includes('\0')) throw new Error('Binary files are not supported.')
  return { text }
}
