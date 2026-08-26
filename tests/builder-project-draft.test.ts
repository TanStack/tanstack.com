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
  blankBuilderProject,
  clearBuilderProjectDraft,
  createBuilderProjectDraftId,
  createBuilderProjectFromTemplateId,
  createBuilderTemplateProject,
  getBrowserBuilderProjectDraftStorage,
  loadBuilderProjectDraft,
  builderProjectDraftStorageKey,
  saveBuilderProjectDraft,
} from '../src/utils/builder-project-draft'
import { builderStarterSource } from '../src/utils/builder-environment'
import { builderExamples } from '../src/utils/builder-examples'

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
const draftId = '2a57a714-e6b6-476f-bf54-2152577df4fd'

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

test('round-trips a complete builder draft through storage', () => {
  const storage = new MemoryStorage()
  const project = createCompleteProject()

  assert.equal(
    saveBuilderProjectDraft(storage, { id: draftId, project }, updatedAt),
    true,
  )
  assert.ok(storage.getItem(builderProjectDraftStorageKey))
  assert.deepEqual(loadBuilderProjectDraft(storage), {
    id: draftId,
    project,
    updatedAt,
  })
})

test('gives legacy drafts a stable assistant scope when loading', () => {
  const storage = new MemoryStorage()
  const project = createCompleteProject()
  storage.setItem(
    builderProjectDraftStorageKey,
    JSON.stringify({ version: 1, project, updatedAt }),
  )

  const firstLoad = loadBuilderProjectDraft(storage)
  const secondLoad = loadBuilderProjectDraft(storage)
  assert.equal(firstLoad?.id, `legacy-${updatedAt}`)
  assert.equal(secondLoad?.id, firstLoad?.id)
})

test('clears corrupt and invalid builder drafts', async (t) => {
  const invalidDrafts = [
    { name: 'corrupt JSON', source: '{' },
    {
      name: 'unsupported version',
      source: JSON.stringify({ version: 3, project: {}, updatedAt }),
    },
    {
      name: 'invalid draft id',
      source: JSON.stringify({
        version: 2,
        id: '',
        project: createCompleteProject(),
        updatedAt,
      }),
    },
    {
      name: 'invalid project',
      source: JSON.stringify({ version: 1, project: {}, updatedAt }),
    },
    {
      name: 'invalid timestamp',
      source: JSON.stringify({
        version: 1,
        project: blankBuilderProject,
        updatedAt: 'not-a-timestamp',
      }),
    },
  ]

  for (const invalidDraft of invalidDrafts) {
    await t.test(invalidDraft.name, () => {
      const storage = new MemoryStorage()
      storage.setItem(builderProjectDraftStorageKey, invalidDraft.source)

      assert.equal(loadBuilderProjectDraft(storage), undefined)
      assert.equal(storage.getItem(builderProjectDraftStorageKey), null)
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

  assert.equal(loadBuilderProjectDraft(inaccessibleStorage), undefined)
  assert.equal(
    saveBuilderProjectDraft(
      inaccessibleStorage,
      { id: draftId, project: blankBuilderProject },
      updatedAt,
    ),
    false,
  )
  assert.equal(clearBuilderProjectDraft(inaccessibleStorage), false)
  assert.equal(loadBuilderProjectDraft(undefined), undefined)
  assert.equal(
    saveBuilderProjectDraft(
      undefined,
      { id: draftId, project: blankBuilderProject },
      updatedAt,
    ),
    false,
  )
  assert.equal(clearBuilderProjectDraft(undefined), false)
  assert.equal(getBrowserBuilderProjectDraftStorage(), undefined)
  assert.notEqual(createBuilderProjectDraftId(), createBuilderProjectDraftId())
})

test('constructs blank and example builder projects', () => {
  assert.deepEqual(
    blankBuilderProject,
    createBuilderTemplateProject({
      title: 'Untitled project',
      description: '',
      source: builderStarterSource,
    }),
  )

  for (const example of builderExamples) {
    const project = createBuilderTemplateProject(example)
    assert.deepEqual(createBuilderProjectFromTemplateId(example.id), project)
    assert.equal(project.title, example.title)
    assert.equal(project.description, example.description)
    assert.equal(project.initialFile, '/index.tsx')
    assert.equal(project.workspace.entry, '/index.tsx')
    assert.equal(project.workspace.environment, 'client')
    assert.deepEqual(project.workspace.files, {
      '/index.tsx': example.source,
    })
  }

  assert.equal(createBuilderProjectFromTemplateId('unknown'), undefined)
})
