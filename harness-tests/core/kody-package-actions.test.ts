import { describe, expect, it } from 'vitest'
import {
  KodyActionCatalog,
  compileKodyAction,
} from '../../src/chat/server/kody-actions'
import {
  assertKodyPackageRevision,
  KODY_PACKAGE_REVISION_CODE,
  kodyPackageDetailMode,
  kodyPackageActionCode,
  readKodyPackageAction,
} from '../../src/chat/server/kody-package-actions'

const packageId = '149fd608-2ec1-4da1-9d93-f85816d74ccc'
const sourceId = '901e03c0-f21f-4860-90fb-555edbaeccba'
const publishedCommit = '8f1511867e03534537690f453a77040255ee9738'
const entity = `package:${packageId}#./list-conversations`

function projected(overrides: Record<string, unknown> = {}) {
  return {
    structuredContent: {
      result: {
        format: 'gum-kody-package-action-v1',
        packageId,
        sourceId,
        publishedCommit,
        kodyId: 'slack',
        packageName: '@tannerlinsley/slack',
        subpath: './list-conversations',
        title: 'List Slack conversations',
        importSpecifier: 'kody:@tannerlinsley/slack/list-conversations',
        functions: [
          {
            name: 'default',
            typeDefinition:
              'export default function listConversations(input: {})',
            description: 'List conversations',
          },
        ],
        ...overrides,
      },
    },
  }
}

describe('paired Kody package action lookup', () => {
  it('distinguishes package exports from indexes and documents', () => {
    const detail = (detailMode: string) => ({
      structuredContent: {
        result: { kind: 'entity', type: 'package', detailMode },
      },
    })
    expect(kodyPackageDetailMode(detail('export'))).toBe('export')
    expect(kodyPackageDetailMode(detail('file'))).toBe('file')
    expect(kodyPackageDetailMode(detail('index'))).toBe('index')
    expect(kodyPackageDetailMode(detail('unknown'))).toBeNull()
  })

  it('projects the exact export without returning package source or another export', async () => {
    const code = kodyPackageActionCode(entity)
      .replace(/^import .*\n/, '')
      .replace('export default async function main', 'async function main')
    const run = new Function('kody', code + '\nreturn main()') as (
      kody: unknown,
    ) => Promise<unknown>
    const result = await run({
      packageGet: async () => ({
        package_id: packageId,
        source_id: sourceId,
        name: '@tannerlinsley/slack',
        kody_id: 'slack',
        source: 'private package source',
        exports: [
          {
            subpath: './unrelated',
            import_specifier: 'kody:@tannerlinsley/slack/unrelated',
            functions: [{ name: 'other' }],
          },
          {
            subpath: './list-conversations',
            import_specifier: 'kody:@tannerlinsley/slack/list-conversations',
            functions: [
              {
                name: 'default',
                type_definition:
                  'export default function listConversations(input: {})',
                description: 'List conversations',
              },
            ],
          },
        ],
      }),
      repoShowPublishNote: async () => ({
        source_id: sourceId,
        commit: publishedCommit,
      }),
    })
    expect(result).toEqual({
      ...projected().structuredContent.result,
      title: './list-conversations',
    })
    expect(JSON.stringify(result)).not.toContain('private package source')
    expect(JSON.stringify(result)).not.toContain('unrelated')
  })

  it('reads one exact package export and registers its callable function', () => {
    const detail = readKodyPackageAction(projected(), entity)
    const catalog = new KodyActionCatalog()
    const [action] = catalog.register(
      { structuredContent: { result: detail } },
      entity,
    )
    expect(action.target).toEqual({
      kind: 'package',
      packageId,
      sourceId,
      publishedCommit,
      importSpecifier: 'kody:@tannerlinsley/slack/list-conversations',
      exportName: 'default',
    })
    expect(
      compileKodyAction(catalog.selectEntity(entity, undefined, {})).code,
    ).toContain('entry["default"](params)')
  })

  it('keeps JSDoc useful for discovery without making it the approval title', () => {
    const description =
      'Answer a factual public-information question with source evidence. Use for web lookups.\n@param input - Question and limits.\n@example\nconst result = await answer({ question: "test" })'
    const detail = readKodyPackageAction(
      projected({
        title: description.slice(0, 200),
        functions: [{ name: 'default', typeDefinition: null, description }],
      }),
      entity,
    )
    const catalog = new KodyActionCatalog()
    const [action] = catalog.register(
      { structuredContent: { result: detail } },
      entity,
    )
    expect(action.title).toBe(
      'Answer a factual public-information question with source evidence.',
    )
    expect(action.title).not.toContain('@param')
  })

  it('uses each callable function’s own title when an export has several', () => {
    const detail = readKodyPackageAction(
      projected({
        functions: [
          {
            name: 'read',
            typeDefinition: null,
            description: 'Read the latest notes.\n@param input - Filters.',
          },
          {
            name: 'save',
            typeDefinition: null,
            description: 'Save a note for later.\n@param input - Note.',
          },
        ],
      }),
      entity,
    )
    const catalog = new KodyActionCatalog()
    const actions = catalog.register(
      { structuredContent: { result: detail } },
      entity,
    )
    expect(actions.map((action) => action.title)).toEqual([
      'Read the latest notes.',
      'Save a note for later.',
    ])
    expect(catalog.selectEntity(entity, 'save', {}).title).toBe(
      'Save a note for later.',
    )
  })

  it('inspects a non-callable package export without proposing an action', () => {
    const helperEntity = `package:${packageId}#./wikipedia-read`
    const detail = readKodyPackageAction(
      projected({
        subpath: './wikipedia-read',
        title: 'Wikipedia helper',
        importSpecifier: 'kody:@tannerlinsley/slack/wikipedia-read',
        functions: [],
      }),
      helperEntity,
    )
    const catalog = new KodyActionCatalog()
    expect(
      catalog.register({ structuredContent: { result: detail } }, helperEntity),
    ).toEqual([])
    expect(catalog.hasInspected(helperEntity)).toBe(true)
    expect(() => catalog.selectEntity(helperEntity, undefined, {})).toThrow(
      'No supported action matches',
    )
  })

  it('only embeds a validated package ID and export subpath in the read-only lookup', () => {
    const code = kodyPackageActionCode(entity)
    expect(code).toContain(`kody.packageGet({ package_id: packageId })`)
    expect(code).toContain('item.subpath === subpath')
    expect(code).not.toContain('packageSave')
    expect(() => kodyPackageActionCode('package:bad name#./read')).toThrow()
    expect(() =>
      kodyPackageActionCode(`package:${packageId}#./../read`),
    ).toThrow()
  })

  it('resolves the short package references returned by Kody search', async () => {
    const alias = 'package:slack#list-conversations'
    const code = kodyPackageActionCode(alias)
      .replace(/^import .*\n/, '')
      .replace('export default async function main', 'async function main')
    const calls: string[] = []
    const run = new Function('kody', code + '\nreturn main()') as (
      kody: unknown,
    ) => Promise<unknown>
    const result = await run({
      packageList: async () => {
        calls.push('packageList')
        return {
          packages: [
            {
              package_id: packageId,
              kody_id: 'slack',
              name: '@tannerlinsley/slack',
            },
          ],
        }
      },
      packageGet: async () => {
        calls.push('packageGet')
        return {
          package_id: packageId,
          source_id: sourceId,
          kody_id: 'slack',
          name: '@tannerlinsley/slack',
          exports: [
            {
              subpath: './list-conversations',
              import_specifier: 'kody:@tannerlinsley/slack/list-conversations',
              functions: [
                { name: 'default', description: 'List conversations' },
              ],
            },
          ],
        }
      },
      repoShowPublishNote: async () => {
        calls.push('repoShowPublishNote')
        return { source_id: sourceId, commit: publishedCommit }
      },
    })
    expect(calls).toEqual([
      'packageList',
      'repoShowPublishNote',
      'packageGet',
      'repoShowPublishNote',
    ])
    const detail = readKodyPackageAction(
      { structuredContent: { result } },
      alias,
    )
    const catalog = new KodyActionCatalog()
    expect(
      catalog.register({ structuredContent: { result: detail } }, alias),
    ).toHaveLength(1)
    expect(catalog.selectEntity(alias, undefined, {}).target).toEqual({
      kind: 'package',
      packageId,
      sourceId,
      publishedCommit,
      importSpecifier: 'kody:@tannerlinsley/slack/list-conversations',
      exportName: 'default',
    })
  })

  it('rejects a package republished while its export is being inspected', async () => {
    const code = kodyPackageActionCode(entity)
      .replace(/^import .*\n/, '')
      .replace('export default async function main', 'async function main')
    const run = new Function('kody', code + '\nreturn main()') as (
      kody: unknown,
    ) => Promise<unknown>
    let noteReads = 0
    await expect(
      run({
        repoShowPublishNote: async () => ({
          source_id: sourceId,
          commit: ++noteReads === 1 ? publishedCommit : '0'.repeat(40),
        }),
        packageGet: async () => ({
          package_id: packageId,
          source_id: sourceId,
          kody_id: 'slack',
          name: '@tannerlinsley/slack',
          exports: [
            {
              subpath: './list-conversations',
              import_specifier: 'kody:@tannerlinsley/slack/list-conversations',
              functions: [{ name: 'default' }],
            },
          ],
        }),
      }),
    ).rejects.toThrow('changed during inspection')
  })

  it('rejects mismatched, ambiguous, and failed metadata', () => {
    expect(() =>
      readKodyPackageAction(projected({ subpath: './other' }), entity),
    ).toThrow('did not match')
    expect(() =>
      readKodyPackageAction(
        projected({ packageId: crypto.randomUUID() }),
        entity,
      ),
    ).toThrow('did not match')
    expect(() =>
      readKodyPackageAction(
        projected({
          functions: [
            { name: 'default', typeDefinition: null, description: null },
            { name: 'default', typeDefinition: null, description: null },
          ],
        }),
        entity,
      ),
    ).toThrow('duplicate')
    expect(() =>
      readKodyPackageAction({ ...projected(), isError: true }, entity),
    ).toThrow('failed')
  })

  it('checks the published commit again before an approved package function runs', async () => {
    const catalog = new KodyActionCatalog()
    catalog.register(
      {
        structuredContent: {
          result: readKodyPackageAction(projected(), entity),
        },
      },
      entity,
    )
    const compiled = compileKodyAction(
      catalog.selectEntity(entity, undefined, {}),
    )
    const body = compiled.code
      .replace(/^import .*\n/gm, '')
      .replace('export default async function main', 'async function main')
      .replace('await import(specifier)', 'await loadPackage(specifier)')
    const run = new Function(
      'kody',
      'loadPackage',
      'params',
      body + '\nreturn main(params)',
    ) as (
      kody: unknown,
      loadPackage: unknown,
      params: unknown,
    ) => Promise<unknown>
    const calls: string[] = []
    const loadPackage = async () => {
      calls.push('import')
      return { default: async () => calls.push('invoke') }
    }
    const kody = (commit: string) => ({
      repoShowPublishNote: async () => {
        calls.push('revision')
        return { source_id: sourceId, commit }
      },
    })
    await expect(run(kody('0'.repeat(40)), loadPackage, {})).rejects.toThrow(
      'changed after its action was prepared',
    )
    expect(calls).toEqual(['revision'])
    await run(kody(publishedCommit), loadPackage, {})
    expect(calls).toEqual(['revision', 'revision', 'import', 'invoke'])
  })

  it('uses Kody’s supported static import for a root package export', () => {
    const rootEntity = `package:${packageId}#.`
    const detail = readKodyPackageAction(
      projected({
        subpath: '.',
        importSpecifier: 'kody:@tannerlinsley/answer-question',
      }),
      rootEntity,
    )
    const catalog = new KodyActionCatalog()
    catalog.register({ structuredContent: { result: detail } }, rootEntity)
    const compiled = compileKodyAction(
      catalog.selectEntity(rootEntity, undefined, {}),
    )
    expect(compiled.code).toContain(
      'import * as entry from "kody:@tannerlinsley/answer-question"',
    )
    expect(compiled.code).not.toContain('await import(specifier)')
    expect(compiled.code).toContain('published.commit !==')
  })

  it('rejects a stale package approval before starting execution', async () => {
    const code = KODY_PACKAGE_REVISION_CODE.replace(/^import .*\n/, '').replace(
      'export default async function main',
      'async function main',
    )
    const run = new Function(
      'kody',
      'params',
      code + '\nreturn main(params)',
    ) as (kody: unknown, params: unknown) => Promise<unknown>
    const result = await run(
      {
        repoShowPublishNote: async () => ({
          source_id: sourceId,
          commit: '0'.repeat(40),
        }),
      },
      { packageId },
    )
    const envelope = { structuredContent: { result } }
    expect(() =>
      assertKodyPackageRevision(envelope, { sourceId, publishedCommit }),
    ).toThrow('changed after its action was prepared')
    expect(() =>
      assertKodyPackageRevision(
        { structuredContent: { result: { sourceId, publishedCommit } } },
        { sourceId, publishedCommit },
      ),
    ).not.toThrow()
  })
})
