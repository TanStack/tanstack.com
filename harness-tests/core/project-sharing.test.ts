import { afterEach, expect, it, vi } from 'vitest'
const stored = vi.hoisted(() => vi.fn())
vi.mock('~/utils/builder-project.client', () => ({
  storeBuilderProjectRevision: stored,
}))
import {
  createSharedExampleUrl,
  decodeSharedExampleProject,
} from '../../src/utils/example-share.client'
import { blankBuilderProject } from '../../src/utils/builder-project-draft'
afterEach(() => {
  vi.unstubAllGlobals()
  stored.mockReset()
})
it('round trips small project links without uploading', async () => {
  vi.stubGlobal('window', { location: { origin: 'https://tanstack.com' } })
  const url = await createSharedExampleUrl(blankBuilderProject)
  expect(url.pathname).toBe('/chat/shared')
  expect(await decodeSharedExampleProject(url.hash)).toEqual(
    blankBuilderProject,
  )
  expect(stored).not.toHaveBeenCalled()
})
it('stores large shared projects through the snapshot client', async () => {
  vi.stubGlobal('window', { location: { origin: 'https://tanstack.com' } })
  const random = crypto.getRandomValues(new Uint8Array(32_000))
  const source = Array.from(random, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  const project = {
    ...blankBuilderProject,
    workspace: {
      ...blankBuilderProject.workspace,
      files: { ...blankBuilderProject.workspace.files, '/large.txt': source },
    },
  }
  stored.mockResolvedValue('snapshot-hash')
  const url = await createSharedExampleUrl(project)
  expect(stored).toHaveBeenCalledWith(project)
  expect(url.href).toBe('https://tanstack.com/chat/p/snapshot-hash')
})
