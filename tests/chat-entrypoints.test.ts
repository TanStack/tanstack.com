import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function publicMethods(path: string, name: string) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const declaration = source.statements.find(
    (node): node is ts.ClassDeclaration =>
      ts.isClassDeclaration(node) && node.name?.text === name,
  )
  assert.ok(declaration, `${name} must exist`)
  return declaration.members
    .filter((node): node is ts.MethodDeclaration =>
      ts.isMethodDeclaration(node),
    )
    .filter(
      (node) =>
        !node.modifiers?.some(
          (modifier) =>
            modifier.kind === ts.SyntaxKind.PrivateKeyword ||
            modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
            modifier.kind === ts.SyntaxKind.StaticKeyword,
        ),
    )
    .map((node) => node.name.getText(source))
    .sort()
}

// A missing method here would silently remove a deployed RPC endpoint.
for (const [name, implementation] of [
  ['Conversation', 'src/chat/server/conversation.ts'],
  ['WorkspaceSync', 'src/chat/server/workspace-sync-object.ts'],
  [
    'StreamObject',
    'node_modules/@durable-streams/server-cloudflare/dist/index.d.ts',
  ],
  ['TanChatWorkflow', 'src/chat/server/workflow-driver.ts'],
]) {
  test(`lazy ${name} preserves every public RPC and lifecycle method`, () => {
    assert.deepEqual(
      publicMethods('src/chat/server/entries.ts', name),
      publicMethods(implementation, name),
    )
  })
}
