import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ storage: vi.fn(), get: vi.fn() }))
vi.mock('~/server/runtime/blob-storage.server', () => ({
  getBlobStorage: m.storage,
}))
import { readBuilderProjectSnapshot } from '../../src/utils/builder-project-snapshot-storage.server'
import { sha256Hex } from '../../src/utils/hash'
import { createExampleWorkspace } from '../../src/utils/example-workspace'
import {
  createSharedExampleProject,
  serializeSharedExampleProject,
} from '../../src/utils/example-project'
const project = createSharedExampleProject({
  title: 'App',
  workspace: createExampleWorkspace({
    entry: '/index.ts',
    files: { '/index.ts': 'export default 9' },
  }),
})
beforeEach(() => {
  vi.resetAllMocks()
  m.storage.mockResolvedValue({ get: m.get })
})
function compressed(source: string) {
  return new Blob([source]).stream().pipeThrough(new CompressionStream('gzip'))
}
it('reads the original compressed canonical snapshot and validates its hash', async () => {
  const source = serializeSharedExampleProject(project)
  const hash = await sha256Hex(source)
  m.get
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ body: compressed(source) })
  expect(await readBuilderProjectSnapshot(hash)).toEqual(project)
})
it('does not read a quarantined snapshot', async () => {
  m.get.mockResolvedValue({ text: () => Promise.resolve('{}') })
  expect(await readBuilderProjectSnapshot('a'.repeat(64))).toBeNull()
  expect(m.get).toHaveBeenCalledTimes(1)
})
it('rejects corrupted source even if the stored JSON shape is valid', async () => {
  m.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
    body: compressed(serializeSharedExampleProject(project)),
  })
  await expect(readBuilderProjectSnapshot('b'.repeat(64))).rejects.toThrow(
    'integrity check failed',
  )
})
it('stops decompression beyond the existing canonical byte limit', async () => {
  const source = 'x'.repeat(1024 * 1024 + 1)
  m.get
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ body: compressed(source) })
  await expect(
    readBuilderProjectSnapshot(await sha256Hex(source)),
  ).rejects.toThrow('exceeds 1 MiB')
})
