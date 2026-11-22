import { expect, it, vi } from 'vitest'

const routes = vi.hoisted(() => {
  type Context = {
    location: { hash: string }
    params: { id: string; hash: string }
    search: { template?: string }
  }
  const callbacks = new Map<string, (context: Context) => void>()
  return { callbacks }
})
vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    (path: string) =>
    (options: { beforeLoad: Parameters<typeof routes.callbacks.set>[1] }) => {
      routes.callbacks.set(path, options.beforeLoad)
      return options
    },
  redirect: (options: Record<string, unknown>) => options,
}))

it('enters isolated chat with a full document navigation while preserving legacy destinations', async () => {
  await Promise.all([
    import('../../src/routes/builder'),
    import('../../src/routes/builder_.$id'),
    import('../../src/routes/builder_.ai'),
    import('../../src/routes/builder_.new'),
    import('../../src/routes/builder_.p.$hash'),
  ])
  const cases = [
    { path: '/builder', hash: '', expected: { to: '/chat' } },
    {
      path: '/builder',
      hash: 'project=shared',
      expected: { to: '/chat' },
    },
    {
      path: '/builder',
      hash: 'code=example',
      expected: { to: '/chat' },
    },
    { path: '/builder_/ai', hash: '', expected: { to: '/chat' } },
    {
      path: '/builder_/$id',
      hash: '',
      expected: {
        to: '/chat/project/$projectId',
        params: { projectId: 'private-project' },
      },
    },
    {
      path: '/builder_/p/$hash',
      hash: '',
      expected: { to: '/chat/p/$hash', params: { hash: 'public-project' } },
    },
    {
      path: '/builder_/new',
      hash: '',
      expected: { to: '/chat/new-project', search: { template: 'react' } },
    },
  ]
  for (const item of cases) {
    const beforeLoad = routes.callbacks.get(item.path)
    expect(beforeLoad).toBeDefined()
    let result: unknown
    try {
      beforeLoad?.({
        location: { hash: item.hash },
        params: { id: 'private-project', hash: 'public-project' },
        search: { template: 'react' },
      })
    } catch (error) {
      result = error
    }
    expect(result).toEqual({
      ...item.expected,
      replace: true,
      reloadDocument: true,
    })
  }
})
