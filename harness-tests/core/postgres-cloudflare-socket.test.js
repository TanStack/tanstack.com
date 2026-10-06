import { expect, it, vi } from 'vitest'
import { net, tls } from '../../node_modules/postgres/cf/polyfills.js'

it('does not reject the read loop after an intentional socket close', async () => {
  const socket = new net.Socket()
  socket.reader = {
    read: vi.fn().mockRejectedValue(new Error('This socket has been closed.')),
  }
  socket.close()
  // Postgres removes its error listener after close. A late reader rejection
  // must not become an unhandled rejection in the worker.
  await expect(socket.read()).resolves.toBeUndefined()
})

it('finishes an intentional shutdown once when the pending read is cancelled', async () => {
  const socket = new net.Socket()
  socket.raw = { close: vi.fn().mockResolvedValue(undefined) }
  socket.reader = {
    read: vi.fn().mockRejectedValue(new Error('Stream was cancelled.')),
  }
  const closed = vi.fn()
  const failed = vi.fn()
  socket.on('close', closed)
  socket.on('error', failed)
  await socket.end()
  await socket.read()
  await socket.end()
  expect(closed).toHaveBeenCalledOnce()
  expect(failed).not.toHaveBeenCalled()
  expect(socket.raw.close).toHaveBeenCalledOnce()
})

it('still reports a connection failure before shutdown', async () => {
  const socket = new net.Socket()
  const failure = new Error('Connection lost')
  socket.reader = { read: vi.fn().mockRejectedValue(failure) }
  const failed = vi.fn()
  const closed = vi.fn()
  socket.on('error', failed)
  socket.on('close', closed)
  await socket.read()
  expect(failed).toHaveBeenCalledWith(failure)
  expect(closed).toHaveBeenCalledOnce()
})

it('marks an upgraded TLS socket closed before reporting a cancelled read', async () => {
  const socket = new net.Socket()
  let resolveClose
  let rejectRead
  const closed = new Promise((resolve) => {
    resolveClose = resolve
  })
  const read = new Promise((_, reject) => {
    rejectRead = reject
  })
  socket.writer = { releaseLock: vi.fn() }
  socket.reader = { releaseLock: vi.fn() }
  socket.raw = {
    startTls: () => ({
      closed,
      readable: { getReader: () => ({ read: () => read }) },
      writable: { getWriter: () => ({ ready: Promise.resolve() }) },
    }),
  }
  const reading = vi.spyOn(socket, 'read')
  const failed = vi.fn()
  socket.on('error', failed)
  tls.connect({ socket, servername: 'database.test' })
  await Promise.resolve()
  resolveClose()
  await Promise.resolve()
  rejectRead(new Error('This socket has been closed.'))
  await reading.mock.results[0].value
  expect(socket.readyState).toBe('closed')
  expect(failed).not.toHaveBeenCalled()
})
