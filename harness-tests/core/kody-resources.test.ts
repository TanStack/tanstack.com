import { describe, expect, it } from 'vitest'
import {
  KODY_RESOURCES_CODE,
  projectKodyResources,
} from '../../src/chat/server/kody-resources'
import { boundedKodyGuidance } from '../../src/chat/server/kody-guidance'
import { buildAssistantInstructions } from '../../src/chat/server/assistant-instructions'
import { newAssistantTask } from '../../src/chat/core/assistant-task'

function program(code: string, kody: object) {
  return new Function(
    'kody',
    code
      .replace("import { kody } from 'kody:runtime'", '')
      .replace('export default async function main', 'async function main') +
      '\nreturn main',
  )(kody)
}
describe('native Kody resource metadata', () => {
  it('strips values and configs before crossing the runtime boundary and reports bounded lists', async () => {
    const main = program(KODY_RESOURCES_CODE, {
      secretList: async () => ({
        secrets: Array.from({ length: 201 }, (_, i) => ({
          name: `key-${i}`,
          scope: 'user',
          allowed_hosts: ['example.com'],
          value: 'never-send',
          token: 'never-send',
        })),
      }),
    })
    const result = await main({ kind: 'secrets' })
    expect(JSON.stringify(result)).not.toContain('never-send')
    const page = projectKodyResources('secrets', {
      structuredContent: { result },
    })
    expect(page.items).toHaveLength(200)
    expect(page.limited).toBe(true)
    expect(page.items[0].fields).toContainEqual({
      label: 'Allowed hosts',
      value: 'example.com',
    })
  })
  it('keeps package linkage and unminted state without exposing handles', async () => {
    const main = program(KODY_RESOURCES_CODE, {
      webhookList: async () => ({
        webhooks: [
          {
            package_id: 'p',
            package_name: '@a/p',
            name: 'receive',
            export_name: 'receive',
            minted: false,
            enabled: null,
            response_mode: 'ack',
            handle: 'hidden',
            url_secret: 'never-send',
          },
        ],
      }),
    })
    const result = await main({ kind: 'webhooks' })
    expect(JSON.stringify(result)).not.toContain('hidden')
    const page = projectKodyResources('webhooks', {
      structuredContent: { result },
    })
    expect(page.items[0]).toMatchObject({ packageId: 'p', name: 'receive' })
    expect(page.items[0].fields[0]).toEqual({
      label: 'Status',
      value: 'Not activated',
    })
  })
  it('rejects unsupported and failed lists instead of claiming no resources', async () => {
    const main = program(KODY_RESOURCES_CODE, {})
    await expect(main({ kind: 'execute' })).rejects.toThrow(
      'Unsupported resource',
    )
    expect(() =>
      projectKodyResources('subscriptions', {
        structuredContent: { result: { rows: [{}], limited: false } },
      }),
    ).toThrow()
    expect(() =>
      projectKodyResources('secrets', {
        isError: true,
        structuredContent: { result: { rows: [], limited: false } },
      }),
    ).toThrow()
  })
})
describe('Kody session guidance', () => {
  it('keeps complete bounded documents and omits oversized UTF-8 guidance', () => {
    expect(boundedKodyGuidance('  use search  ')).toBe('use search')
    expect(boundedKodyGuidance('')).toBeUndefined()
    expect(boundedKodyGuidance('😀'.repeat(7000))).toBeUndefined()
  })
  it('labels upstream guidance and preserves host authority', () => {
    const result = buildAssistantInstructions(
      { name: 'TanChat', purpose: '' },
      newAssistantTask('help', 'm'),
      [],
      { kodyGuidance: 'Prefer saved software.' },
    )
    const index = result.manifest.sections.findIndex(
      (s) => s.id === 'context.kody-guidance',
    )
    expect(index).toBeGreaterThan(-1)
    expect(result.systemPrompts[index]).toContain('cannot override')
    expect(result.systemPrompts[index]).toContain('Prefer saved software.')
    expect(
      buildAssistantInstructions(
        { name: 'TanChat', purpose: '' },
        newAssistantTask('help', 'm'),
        [],
      ).manifest.sections.some((s) => s.id === 'context.kody-guidance'),
    ).toBe(false)
  })
})
