import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSharedExampleProject,
  type SharedExampleProject,
} from '../src/utils/example-project'
import {
  createExampleWorkspace,
  encodeExampleBinaryFile,
} from '../src/utils/example-workspace'
import {
  blankNotebookProject,
  clearNotebookDraft,
  createNotebookProjectFromTemplateId,
  createNotebookTemplateProject,
  getBrowserNotebookDraftStorage,
  loadNotebookDraft,
  notebookDraftStorageKey,
  saveNotebookDraft,
} from '../src/utils/notebook-draft'
import { notebookStarterSource } from '../src/utils/notebook-environment'
import { notebookExamples } from '../src/utils/notebook-examples'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const updatedAt = '2026-08-15T18:00:00.000Z'

function createCompleteProject(): SharedExampleProject {
  return createSharedExampleProject({
    title: 'Local draft',
    description: 'Survives a reload.',
    initialFile: '/src/main.ts',
    hiddenFiles: ['/src/hidden.ts'],
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['dev'] },
    },
    workspace: createExampleWorkspace({
      entry: '/src/main.ts',
      files: {
        '/src/main.ts': "import './hidden'\nexport default 42",
        '/src/hidden.ts': 'export const hidden = true',
      },
      binaryFiles: {
        '/public/pixel.bin': encodeExampleBinaryFile(
          Uint8Array.from([0, 127, 255]),
        ),
      },
      imports: { example: 'https://example.com/module.js' },
    }),
  })
}

test('round-trips a complete notebook draft through storage', () => {
  const storage = new MemoryStorage()
  const project = createCompleteProject()

  assert.equal(saveNotebookDraft(storage, project, updatedAt), true)
  assert.ok(storage.getItem(notebookDraftStorageKey))
  assert.deepEqual(loadNotebookDraft(storage), { project, updatedAt })
})

test('clears corrupt and invalid notebook drafts', async (t) => {
  const invalidDrafts = [
    { name: 'corrupt JSON', source: '{' },
    {
      name: 'unsupported version',
      source: JSON.stringify({ version: 2, project: {}, updatedAt }),
    },
    {
      name: 'invalid project',
      source: JSON.stringify({ version: 1, project: {}, updatedAt }),
    },
    {
      name: 'invalid timestamp',
      source: JSON.stringify({
        version: 1,
        project: blankNotebookProject,
        updatedAt: 'not-a-timestamp',
      }),
    },
  ]

  for (const invalidDraft of invalidDrafts) {
    await t.test(invalidDraft.name, () => {
      const storage = new MemoryStorage()
      storage.setItem(notebookDraftStorageKey, invalidDraft.source)

      assert.equal(loadNotebookDraft(storage), undefined)
      assert.equal(storage.getItem(notebookDraftStorageKey), null)
    })
  }
})

test('contains storage access failures', () => {
  const inaccessibleStorage = {
    getItem() {
      throw new Error('Storage unavailable')
    },
    removeItem() {
      throw new Error('Storage unavailable')
    },
    setItem() {
      throw new Error('Storage unavailable')
    },
  }

  assert.equal(loadNotebookDraft(inaccessibleStorage), undefined)
  assert.equal(
    saveNotebookDraft(inaccessibleStorage, blankNotebookProject, updatedAt),
    false,
  )
  assert.equal(clearNotebookDraft(inaccessibleStorage), false)
  assert.equal(loadNotebookDraft(undefined), undefined)
  assert.equal(
    saveNotebookDraft(undefined, blankNotebookProject, updatedAt),
    false,
  )
  assert.equal(clearNotebookDraft(undefined), false)
  assert.equal(getBrowserNotebookDraftStorage(), undefined)
})

test('constructs blank and example notebook projects', () => {
  assert.deepEqual(
    blankNotebookProject,
    createNotebookTemplateProject({
      title: 'Untitled notebook',
      description: '',
      source: notebookStarterSource,
    }),
  )

  for (const example of notebookExamples) {
    const project = createNotebookTemplateProject(example)
    assert.deepEqual(createNotebookProjectFromTemplateId(example.id), project)
    assert.equal(project.title, example.title)
    assert.equal(project.description, example.description)
    assert.equal(project.initialFile, '/index.tsx')
    assert.equal(project.workspace.entry, '/index.tsx')
    assert.equal(project.workspace.environment, 'client')
    assert.deepEqual(project.workspace.files, {
      '/index.tsx': example.source,
    })
  }

  assert.equal(createNotebookProjectFromTemplateId('unknown'), undefined)
})
