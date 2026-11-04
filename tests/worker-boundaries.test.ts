import { z } from 'zod'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { defineHttpRoute } from '../src/server/runtime/http-route.server'
import { chatHttpRoutes } from '../src/chat/server/http/routes'
import { starterHttpRoutes } from '../src/application-starter/api/http/routes'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { forwardWorkerRequest } from '../src/server/runtime/worker-service.server'

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? routeFiles(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    )
    .filter((file) => file.endsWith('.ts'))
}

for (const group of [
  {
    name: 'chat',
    directories: ['src/routes/api/chat', 'src/routes/auth/mcp'],
    routes: chatHttpRoutes,
  },
  {
    name: 'starter',
    directories: ['src/routes/api/application-starter'],
    routes: starterHttpRoutes,
  },
]) {
  test(`every public ${group.name} route has the same methods in its Worker`, () => {
    const files = group.directories.flatMap(routeFiles)
    const routes = group.routes
    assert.equal(routes.length, files.length)
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      )
      let routePath = ''
      const methods: string[] = []
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'createFileRoute'
        ) {
          const argument = node.arguments[0]
          assert.ok(ts.isStringLiteral(argument))
          routePath = argument.text
        }
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(source) === 'handlers'
        ) {
          assert.ok(ts.isObjectLiteralExpression(node.initializer))
          methods.push(
            ...node.initializer.properties.map(
              (property) => property.name?.getText(source) ?? '',
            ),
          )
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
      const route = routes.find((route) => route.path === routePath)
      assert.ok(route, routePath)
      const url =
        'https://tanstack.com' +
        routePath.replace(/\$([^/]*)/g, (_, name) =>
          name ? 'example' : 'account/example',
        )
      for (const method of methods) {
        const match = route.match(new Request(url, { method }))
        assert.ok(match?.handler, `${method} ${routePath}`)
      }
    }
  })
}

test('specific chat routes win over parameters and the MCP splat', () => {
  for (const pathname of [
    '/api/chat/mcp/contract',
    '/api/chat/bots/bulk',
    '/api/chat/bots/move',
  ]) {
    const request = new Request('https://tanstack.com' + pathname)
    assert.equal(
      chatHttpRoutes.find((route) => route.match(request))?.path,
      pathname,
    )
  }
})

test('Worker routing decodes parameters, accepts trailing slashes and preserves splats', () => {
  const route = defineHttpRoute(
    '/api/chat/projects/$id',
    z.object({ id: z.string() }),
    {
      GET: () => new Response(),
    },
  )
  const match = route.match(
    new Request('https://tanstack.com/api/chat/projects/a%20b/'),
  )
  assert.equal(match?.context.params.id, 'a b')
  const splat = defineHttpRoute(
    '/api/chat/mcp/$',
    z.object({ _splat: z.string() }),
    {
      GET: () => new Response(),
    },
  )
  assert.equal(
    splat.match(new Request('https://tanstack.com/api/chat/mcp/account/one'))
      ?.context.params._splat,
    'account/one',
  )
  assert.ok(
    route.match(
      new Request('https://tanstack.com/api/chat/projects/one', {
        method: 'HEAD',
      }),
    )?.handler,
  )
  assert.equal(
    route.match(
      new Request('https://tanstack.com/api/chat/projects/one', {
        method: 'DELETE',
      }),
    )?.handler,
    undefined,
  )
})

test('service forwarding preserves the original request and streamed response', async () => {
  const request = new Request('https://tanstack.com/api/chat/draft?scope=one', {
    method: 'POST',
    headers: {
      Cookie: 'session=example',
      Origin: 'https://tanstack.com',
      'Content-Type': 'application/json',
    },
    body: '{"text":"hello"}',
  })
  const response = new Response('event: update\ndata: hello\n\n', {
    headers: { 'Content-Type': 'text/event-stream', 'Set-Cookie': 'example=1' },
  })
  const actual = await runWithHostRuntimeEnv(
    {
      CHAT: {
        async fetch(forwarded: Request) {
          assert.equal(forwarded, request)
          assert.equal(forwarded.headers.get('Cookie'), 'session=example')
          assert.equal(forwarded.headers.get('Origin'), 'https://tanstack.com')
          assert.equal(await forwarded.text(), '{"text":"hello"}')
          return response
        },
      },
    },
    () => forwardWorkerRequest('CHAT', request),
  )
  assert.equal(actual, response)
  assert.equal(actual.headers.get('Set-Cookie'), 'example=1')
  assert.match(await actual.text(), /event: update/)
})
