import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRepositoryExampleDefinition,
  rewriteEscapingTsconfigExtends,
} from '../src/utils/repository-example'

test('drops tsconfig extends that walk out of the example', () => {
  const files = {
    '/src/main.tsx': 'export const value = 1',
    '/tsconfig.json': JSON.stringify({
      extends: '../../../tsconfig.json',
      include: ['**/*.ts', '**/*.tsx'],
      compilerOptions: {
        paths: { '@/*': ['./src/*'] },
      },
    }),
  }

  const result = rewriteEscapingTsconfigExtends(files)

  assert.deepEqual(JSON.parse(result['/tsconfig.json'] ?? ''), {
    include: ['**/*.ts', '**/*.tsx'],
    compilerOptions: {
      paths: { '@/*': ['./src/*'] },
    },
  })
  assert.equal(result['/src/main.tsx'], 'export const value = 1')
  assert.match(files['/tsconfig.json'] ?? '', /extends/)
})

test('keeps relative and package extends inside the example', () => {
  const files = {
    '/tsconfig.json': JSON.stringify({
      extends: ['./tsconfig.app.json', '@tsconfig/strictest/tsconfig.json'],
    }),
    '/tsconfig.app.json': JSON.stringify({
      compilerOptions: { strict: true },
    }),
  }

  const result = rewriteEscapingTsconfigExtends(files)

  assert.equal(result, files)
})

test('drops only the escaping entries from an extends array', () => {
  const files = {
    '/tsconfig.json': JSON.stringify({
      extends: ['../../../tsconfig.json', './tsconfig.app.json'],
    }),
  }

  const result = rewriteEscapingTsconfigExtends(files)

  assert.deepEqual(JSON.parse(result['/tsconfig.json'] ?? ''), {
    extends: ['./tsconfig.app.json'],
  })
})

test('leaves invalid tsconfig JSON unchanged', () => {
  const files = {
    '/tsconfig.json': '{ not-json',
  }

  const result = rewriteEscapingTsconfigExtends(files)

  assert.equal(result['/tsconfig.json'], '{ not-json')
  assert.equal(result, files)
})

test('createRepositoryExampleDefinition uses the rewritten tsconfig', () => {
  const definition = createRepositoryExampleDefinition({
    entry: '/src/index.tsx',
    files: {
      'src/index.tsx': 'export {}',
      'tsconfig.json': JSON.stringify({
        extends: '../../../tsconfig.json',
        compilerOptions: { jsx: 'react-jsx' },
      }),
    },
    id: 'ai-react-basic-chat',
    title: 'Basic Chat',
  })

  assert.deepEqual(JSON.parse(definition.workspace.files['/tsconfig.json']), {
    compilerOptions: { jsx: 'react-jsx' },
  })
})
