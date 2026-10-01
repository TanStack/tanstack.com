import { describe, it, expect, vi } from 'vitest'
import { assistantFileTools } from '../../src/chat/server/assistant-file-tools'
import {
  SavedFileError,
  type SavedFiles,
} from '../../src/chat/server/saved-files'
import type { SavedFile } from '../../src/chat/core/files'
const scope = {
  workspaceId: 'workspace',
  userId: 'user',
  botId: 'conversation',
}
function setup(taskId = 'task', conversationId?: string, identityVersion?: 2) {
  const selectedScope = {
    ...scope,
    ...(conversationId ? { conversationId } : {}),
  }
  const save = vi.fn(
    async (input: any, bytes: Uint8Array): Promise<SavedFile> => ({
      ...input,
      botId: scope.botId,
      ...(conversationId ? { conversationId } : {}),
      size: bytes.length,
      sha256: 'hash',
      createdAt: 1,
      state: 'ready',
    }),
  )
  const readText = vi.fn(async () => ({
    file: {
      id: '00000000-0000-4000-8000-000000000001',
      botId: scope.botId,
      name: 'a.txt',
      mediaType: 'text/plain',
      size: 3,
      sha256: 'hash',
      source: 'assistant',
      state: 'ready',
      createdAt: 1,
    } as SavedFile,
    text: 'abc',
    offset: 0,
    totalChars: 3,
  }))
  const list = vi.fn(async () => [])
  const files = { save, readText, list }
  const tools = assistantFileTools({
    files,
    scope: selectedScope,
    taskId,
    identityVersion,
  })
  const execute = (name: string, args: any) =>
    tools.find((tool) => tool.name === name)!.execute!(args)
  return { files, execute }
}
describe('native assistant saved files', () => {
  it('isolates version 2 IDs between same-bot conversations and reuses the exact ID after a tool reconstruction', async () => {
    const input = { name: 'notes.txt', content: 'Same task and file contents' }
    const first = (await setup('task', 'thread:A', 2).execute(
      'save_file',
      input,
    )) as any
    const retry = (await setup('task', 'thread:A', 2).execute('save_file', {
      ...input,
      mediaType: 'Text/Plain; charset=UTF-8',
    })) as any
    const sibling = (await setup('task', 'thread:B', 2).execute(
      'save_file',
      input,
    )) as any
    expect(first.ok).toBe(true)
    expect(retry.file.id).toBe(first.file.id)
    expect(sibling.file.id).not.toBe(first.file.id)
    expect(first.file.conversationId).toBe('thread:A')
    expect(sibling.file.conversationId).toBe('thread:B')
    expect(first.file).not.toHaveProperty('viewUrl')
    const missing = setup('task', undefined, 2)
    expect(await missing.execute('save_file', input)).toMatchObject({
      ok: false,
      error: { code: 'file_unavailable' },
    })
    expect(missing.files.save).not.toHaveBeenCalled()
  })

  it('preserves the frozen legacy ID when an old task gains a canonical conversation scope', async () => {
    const input = { name: 'notes.txt', content: 'café' }
    const legacy = (await setup().execute('save_file', input)) as any
    expect(legacy.file.id).toBe('af2ad0dd-a2bb-8f62-89aa-bb2401f61106')
    const resumed = (await setup('task', 'canonical:conversation').execute(
      'save_file',
      input,
    )) as any
    expect(resumed.file.id).toBe(legacy.file.id)
    expect(legacy.file).not.toHaveProperty('conversationId')
    expect(resumed.file.conversationId).toBe('canonical:conversation')
    expect(
      (
        (await setup('task', 'canonical:conversation', 2).execute(
          'save_file',
          input,
        )) as any
      ).file.id,
    ).not.toBe(legacy.file.id)
  })
  it('uses stable retry IDs, fixed authority and UTF8 bytes without model-facing links', async () => {
    const { files, execute } = setup()
    const args = { name: 'notes.txt', content: 'café' }
    const first = (await execute('save_file', args)) as any
    const second = (await execute('save_file', args)) as any
    expect(first.file.id).toBe(second.file.id)
    const canonical = (await execute('save_file', {
      ...args,
      mediaType: 'Text/Plain; charset=UTF-8',
    })) as any
    expect(canonical.file.id).toBe(first.file.id)
    expect(files.save.mock.calls[0][0]).toMatchObject({
      source: 'assistant',
      mediaType: 'text/plain',
    })
    expect(new TextDecoder().decode(files.save.mock.calls[0][1])).toBe('café')
    expect(first.file).not.toHaveProperty('viewUrl')
    expect(first.outcome).toContain('not executed')
    const changed = (await execute('save_file', {
      ...args,
      content: 'different',
    })) as any
    expect(changed.file.id).not.toBe(first.file.id)
    const other = (await setup('other-task').execute('save_file', args)) as any
    expect(other.file.id).not.toBe(first.file.id)
  })
  it('rejects injected authority, binary types and excessive content before save', async () => {
    const { files, execute } = setup()
    for (const args of [
      { name: 'a', content: 'x', source: 'upload' },
      { name: 'a', content: 'x', mediaType: 'image/png' },
      { name: 'a', content: 'x'.repeat(128001) },
    ])
      expect(await execute('save_file', args)).toMatchObject({ ok: false })
    expect(files.save).not.toHaveBeenCalled()
  })
  it('delegates bounded text reads and binary/access rejection to the service', async () => {
    const { files, execute } = setup()
    const id = '00000000-0000-4000-8000-000000000001'
    expect(await execute('read_file', { id, offset: 4 })).toMatchObject({
      ok: true,
      untrusted: true,
    })
    expect(files.readText).toHaveBeenCalledWith(id, { offset: 4, limit: 16000 })
    files.readText.mockRejectedValueOnce(
      new SavedFileError('This file is not text.', 415),
    )
    expect(await execute('read_file', { id })).toMatchObject({
      ok: false,
      error: { status: 415, message: 'This file is not text.' },
    })
    files.readText.mockRejectedValueOnce(new Error('/private/path secret'))
    const failure = await execute('read_file', { id })
    expect(failure).toMatchObject({ ok: false })
    expect(JSON.stringify(failure)).not.toContain('/private/path')
  })
  it('checks service on every retry and lists only its returned scope', async () => {
    const { files, execute } = setup()
    await execute('list_files', {})
    await execute('save_file', { name: 'a', content: 'b' })
    files.save.mockRejectedValueOnce(new Error('revoked'))
    expect(
      await execute('save_file', { name: 'a', content: 'b' }),
    ).toMatchObject({ ok: false })
    expect(files.save).toHaveBeenCalledTimes(2)
    expect(files.list).toHaveBeenCalledTimes(1)
  })
})

it.each([false, true])(
  'keeps a committed file authoritative when stopped after save, publication fails: %s',
  async (publicationFails) => {
    const { files } = setup()
    const controller = new AbortController()
    const originalSave = files.save.getMockImplementation()!
    files.save.mockImplementation(async (...args) => {
      const file = await originalSave(...args)
      controller.abort()
      return file
    })
    const confirm = vi.fn(async () => {
      if (publicationFails)
        throw new Error('private publication failure details')
    })
    const prepare = vi.fn(async () => {})
    const tool = assistantFileTools({
      files,
      scope,
      taskId: 'task',
      delivery: { prepare, confirm },
    }).find((tool) => tool.name === 'save_file')!
    const result = (await tool.execute!(
      { name: 'finished.txt', content: 'Committed bytes' },
      {
        toolCallId: 'call',
        abortSignal: controller.signal,
        emitCustomEvent: () => {},
      },
    )) as any
    expect(controller.signal.aborted).toBe(true)
    expect(files.save).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      ok: true,
      file: { name: 'finished.txt', state: 'ready', size: 15 },
    })
    expect(result.file.id).toBe(files.save.mock.calls[0][0].id)
    expect(result).not.toHaveProperty('error')
    expect(JSON.stringify(result)).not.toContain(
      'private publication failure details',
    )
    if (publicationFails) {
      expect(result.delivery).toEqual({ status: 'pending' })
      expect(result.outcome).toContain('Do not save another version')
    } else expect(result).not.toHaveProperty('delivery')
  },
)

function existingFile(source: SavedFile['source'] = 'upload'): SavedFile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    botId: scope.botId,
    conversationId: 'thread:A',
    name: 'existing.png',
    mediaType: 'image/png',
    size: 20,
    sha256: 'a'.repeat(64),
    source,
    state: 'ready',
    createdAt: 1,
  }
}
function presentation() {
  const base = setup('task', 'thread:A', 2)
  const get = vi.fn(async () => existingFile())
  const prepare = vi.fn(async () => {})
  const confirm = vi.fn(async () => {})
  const files = { ...base.files, get }
  const delivery = { prepare, confirm }
  const tools = assistantFileTools({
    files,
    scope: { ...scope, conversationId: 'thread:A' },
    taskId: 'task',
    delivery,
  })
  const context = { toolCallId: 'present-call', emitCustomEvent: () => {} }
  const execute = (args: unknown = { id: existingFile().id }, overrides = {}) =>
    tools.find((tool) => tool.name === 'present_file')!.execute!(
      args as never,
      { ...context, ...overrides },
    )
  return { files, delivery, execute, tools }
}
it.each(['upload', 'assistant'] as const)(
  'presents an authorized existing %s file without saving or exposing URLs',
  async (source) => {
    const { files, delivery, execute } = presentation()
    files.get.mockResolvedValue({
      ...existingFile(source),
      viewUrl: '/untrusted',
      content: 'do not expose',
    } as SavedFile)
    const result = await execute()
    expect(result).toMatchObject({
      ok: true,
      file: existingFile(source),
      outcome: 'Referenced an existing file. No file was created or changed.',
    })
    expect(files.get).toHaveBeenCalledTimes(2)
    expect(files.get).toHaveBeenNthCalledWith(1, existingFile().id)
    expect(files.get).toHaveBeenNthCalledWith(2, existingFile().id)
    expect(delivery.prepare).toHaveBeenCalledWith(
      'present-call',
      {
        id: existingFile().id,
        name: 'existing.png',
        mediaType: 'image/png',
        size: 20,
        sha256: 'a'.repeat(64),
        source,
      },
      'reference',
    )
    expect(delivery.confirm).toHaveBeenCalledOnce()
    expect(files.save).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain('viewUrl')
    expect(JSON.stringify(result)).not.toContain('do not expose')
  },
)
it('does not expose presentation when a durable publisher or scoped reader is missing', () => {
  const { files } = presentation()
  expect(
    assistantFileTools({ files, scope, taskId: 'task' }).map(
      (tool) => tool.name,
    ),
  ).not.toContain('present_file')
  const { get: _, ...withoutGet } = files
  expect(
    assistantFileTools({
      files: withoutGet,
      scope,
      taskId: 'task',
      delivery: { prepare: vi.fn(), confirm: vi.fn() },
    }).map((tool) => tool.name),
  ).not.toContain('present_file')
})
it('rejects malformed or authority-bearing presentation input before reading', async () => {
  const { files, delivery, execute } = presentation()
  for (const input of [
    { id: '../file' },
    { id: existingFile().id, botId: 'other' },
    { id: existingFile().id, conversationId: 'thread:B' },
  ])
    expect(await execute(input)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    })
  expect(files.get).not.toHaveBeenCalled()
  expect(delivery.prepare).not.toHaveBeenCalled()
})
it('rejects pending files and missing/mismatched exact scope before persisting presentation', async () => {
  const { files, delivery, execute } = presentation()
  for (const changed of [
    { state: 'pending' },
    { botId: 'other' },
    { conversationId: 'thread:B' },
    { conversationId: undefined },
  ]) {
    files.get.mockResolvedValueOnce({
      ...existingFile(),
      ...changed,
    } as SavedFile)
    expect(await execute()).toMatchObject({ ok: false })
  }
  expect(delivery.prepare).not.toHaveBeenCalled()
  expect(files.save).not.toHaveBeenCalled()
})
it('rechecks access after durable prepare and never confirms stale authorization or returns its metadata', async () => {
  const { files, delivery, execute } = presentation()
  files.get
    .mockResolvedValueOnce(existingFile())
    .mockRejectedValueOnce(new SavedFileError('This file is unavailable.', 404))
  const result = await execute()
  expect(result).toMatchObject({ ok: false, error: { status: 404 } })
  expect(result).not.toHaveProperty('file')
  expect(delivery.prepare).toHaveBeenCalledOnce()
  expect(delivery.confirm).not.toHaveBeenCalled()
  expect(files.save).not.toHaveBeenCalled()
})
it('reports publication failure as pending and never replays a storage write', async () => {
  const { files, delivery, execute } = presentation()
  delivery.confirm.mockRejectedValueOnce(
    new Error('private publication failure'),
  )
  const result = await execute()
  expect(result).toMatchObject({
    ok: true,
    delivery: { status: 'pending' },
    file: existingFile(),
  })
  expect(JSON.stringify(result)).toContain('do not repeat present_file')
  expect(JSON.stringify(result)).not.toContain('private publication failure')
  expect(files.save).not.toHaveBeenCalled()
})
it('stops before authorizing or recording a new presentation', async () => {
  const { files, delivery, execute } = presentation()
  const abort = new AbortController()
  abort.abort()
  expect(await execute(undefined, { abortSignal: abort.signal })).toMatchObject(
    { ok: false },
  )
  expect(files.get).not.toHaveBeenCalled()
  expect(delivery.prepare).not.toHaveBeenCalled()
})
it('removes URLs from list and read output while retaining file IDs and scope', async () => {
  const { files } = setup()
  const file = { ...existingFile(), viewUrl: '/not-for-model' } as SavedFile
  files.list.mockResolvedValue([file] as never)
  files.readText.mockResolvedValue({
    file,
    text: 'abc',
    offset: 0,
    totalChars: 3,
  })
  const tools = assistantFileTools({ files, scope, taskId: 'task' })
  for (const name of ['list_files', 'read_file']) {
    const result = await tools.find((tool) => tool.name === name)!.execute!({
      id: file.id,
    } as never)
    expect(result).toMatchObject({ ok: true })
    expect(JSON.stringify(result)).toContain(file.id)
    expect(JSON.stringify(result)).toContain('thread:A')
    expect(JSON.stringify(result)).not.toContain('viewUrl')
  }
})

function copying(
  taskId = 'task',
  conversationId: string | undefined = 'thread:A',
) {
  const base = setup(taskId, conversationId, 2)
  const source = existingFile()
  const copy = vi.fn<SavedFiles['copy']>(async (_id, destination, options) => {
    await options?.beforeSave?.(source)
    return {
      ...source,
      ...destination,
      source: 'assistant',
      ...(conversationId ? { conversationId } : {}),
    }
  })
  const delivery = {
    prepare: vi.fn(async () => {}),
    confirm: vi.fn(async () => {}),
  }
  const tool = assistantFileTools({
    files: { ...base.files, copy },
    scope: { ...scope, ...(conversationId ? { conversationId } : {}) },
    taskId,
    delivery,
  }).find((tool) => tool.name === 'copy_file')!
  const execute = (
    args = { sourceFileId: source.id, name: 'copy.png' },
    toolCallId = 'copy-call',
  ) => tool.execute!(args, { toolCallId, emitCustomEvent: () => {} })
  return { ...base, source, copy, delivery, tool, execute }
}

describe('native copy_file tool', () => {
  it('uses a stable exact-scope output ID across different tool-call retries without model bytes', async () => {
    const first = copying()
    const args = { sourceFileId: first.source.id, name: 'copy.png' }
    const initial = (await first.execute(args)) as any
    const repeated = (await first.execute(args, 'different-call')) as any
    const rebuilt = (await copying().execute(args)) as any
    expect(initial.ok).toBe(true)
    expect(repeated.file.id).toBe(initial.file.id)
    expect(rebuilt.file.id).toBe(initial.file.id)
    expect(initial.file.id).not.toBe(first.source.id)
    expect(initial.file).toMatchObject({
      source: 'assistant',
      mediaType: 'image/png',
      conversationId: 'thread:A',
    })
    expect(first.copy.mock.calls[0]).toEqual([
      first.source.id,
      { id: initial.file.id, name: 'copy.png' },
      { signal: undefined, beforeSave: expect.any(Function) },
    ])
    expect(first.delivery.prepare).toHaveBeenCalledWith(
      'copy-call',
      {
        id: initial.file.id,
        name: 'copy.png',
        mediaType: first.source.mediaType,
        size: first.source.size,
        sha256: first.source.sha256,
      },
      'copy',
    )
    expect(first.delivery.confirm).toHaveBeenCalledWith(
      'copy-call',
      initial.file,
    )
    expect(first.files.save).not.toHaveBeenCalled()
    expect(first.files.readText).not.toHaveBeenCalled()
    expect(initial.file).not.toHaveProperty('viewUrl')
    const otherTask = (await copying('another-task').execute(args)) as any
    expect(otherTask.file.id).not.toBe(initial.file.id)
    const renamed = (await first.execute({
      ...args,
      name: 'another.png',
    })) as any
    expect(renamed.file.id).not.toBe(initial.file.id)
  })

  it('rejects model-supplied content, scope, media type and authority before copying', async () => {
    const f = copying()
    for (const extra of [
      { content: 'replacement bytes' },
      { conversationId: 'thread:B' },
      { mediaType: 'text/plain' },
      { source: 'upload' },
    ])
      expect(
        await f.tool.execute!({
          sourceFileId: f.source.id,
          name: 'copy.png',
          ...extra,
        } as never),
      ).toMatchObject({ ok: false, error: { code: 'invalid_input' } })
    expect(f.copy).not.toHaveBeenCalled()
  })

  it('requires a canonical conversation and checks the source scope before preparing a receipt', async () => {
    const missing = copying('task', undefined)
    // Omission is explicit here because copying() otherwise provides a default.
    const missingTool = assistantFileTools({
      files: { ...missing.files, copy: missing.copy },
      scope,
      taskId: 'task',
      delivery: missing.delivery,
    }).find((tool) => tool.name === 'copy_file')!
    expect(
      await missingTool.execute!({
        sourceFileId: missing.source.id,
        name: 'copy.png',
      }),
    ).toMatchObject({ ok: false })
    expect(missing.copy).not.toHaveBeenCalled()
    const sibling = copying('task', 'thread:B')
    expect(await sibling.execute()).toMatchObject({
      ok: false,
      error: { status: 404 },
    })
    expect(sibling.delivery.prepare).not.toHaveBeenCalled()
    expect(sibling.delivery.confirm).not.toHaveBeenCalled()
  })

  it('retains a confirmed copy when native receipt publication fails', async () => {
    const f = copying()
    f.delivery.confirm.mockRejectedValueOnce(new Error('private failure'))
    const result = (await f.execute()) as any
    expect(result).toMatchObject({
      ok: true,
      delivery: { status: 'pending' },
      file: { state: 'ready', source: 'assistant' },
    })
    expect(result.outcome).toContain('Do not create another copy')
    expect(JSON.stringify(result)).not.toContain('private failure')
  })

  it('reports storage and access failures without confirming a copied file', async () => {
    const f = copying()
    f.copy.mockRejectedValueOnce(
      new SavedFileError(
        'The upload could not finish. Retry the same file to resume.',
        503,
      ),
    )
    expect(await f.execute()).toMatchObject({
      ok: false,
      error: { code: 'file_rejected', status: 503 },
    })
    expect(f.delivery.confirm).not.toHaveBeenCalled()
    f.copy.mockRejectedValueOnce(new Error('private object key'))
    const result = await f.execute()
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'file_unavailable' },
    })
    expect(JSON.stringify(result)).not.toContain('private object key')
  })
})
