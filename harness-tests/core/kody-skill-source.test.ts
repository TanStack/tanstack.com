import { describe, expect, it, vi } from 'vitest'
import { collectKodySkills } from '../../src/chat/server/kody-skill-source'
import type { kodyCall } from '../../src/chat/server/kody'
const packageId = '4b0f2b31-224c-4d8b-8e5d-28dc10456316'
const inventory = {
  structuredContent: {
    result: {
      format: 'gum-kody-inventory-v2',
      capabilities: [],
      exports: ['skill-list', 'skill-get'].map((subpath) => ({
        identity: subpath,
        name: subpath,
        description: '',
        importSpecifier: `kody:@example/skills/${subpath}`,
        exportName: 'default',
        packageId,
        subpath: `./${subpath}`,
      })),
      counts: { domains: 0, packages: 1, advertisedCapabilities: 0 },
      issues: [],
    },
  },
}
const skillText = 'Review the supplied tests.'
const source = () => ({
  structuredContent: {
    result: {
      skills: [
        {
          id: 'test-audit',
          name: 'test-audit',
          description: 'Review tests.',
          packageId,
          updated_at: '2026-09-24T19:06:25.377Z',
          files: [
            {
              path: 'SKILL.md',
              content: `---\nname: test-audit\ndescription: Review tests.\n---\n${skillText}`,
            },
            { path: 'CAMPAIGN.md', content: 'Companion guidance.' },
          ],
        },
      ],
      page: {
        offset: 0,
        next: 1,
        total: 1,
        fingerprint: 'a'.repeat(64),
      },
      errors: [],
    },
  },
})

const env = {
  KODY_ORIGIN: 'https://kody.test',
  ENCRYPTION_KEY: 'not-used-by-injected-transport',
}
const scope = { workspaceId: 'test', userId: 'test' }
describe('ported Kody skill collector', () => {
  it('reads validated list/get exports and preserves companion files', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(source())
    const skills = await collectKodySkills(
      env,
      scope,
      call as typeof kodyCall,
      new AbortController().signal,
    )
    expect(skills).toHaveLength(1)
    expect(skills[0].files[1]).toEqual({
      path: 'CAMPAIGN.md',
      content: 'Companion guidance.',
    })
    expect(call).toHaveBeenCalledTimes(2)
  })
  it('rejects a page with inconsistent counts', async () => {
    const bad = source()
    bad.structuredContent.result.page.next = 0
    const call = vi
      .fn()
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(bad)
    await expect(
      collectKodySkills(
        env,
        scope,
        call as typeof kodyCall,
        new AbortController().signal,
      ),
    ).rejects.toThrow('index changed')
  })
  it('rejects documents from a different package', async () => {
    const bad = source()
    bad.structuredContent.result.skills[0].packageId = crypto.randomUUID()
    const call = vi
      .fn()
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(bad)
    await expect(
      collectKodySkills(
        env,
        scope,
        call as typeof kodyCall,
        new AbortController().signal,
      ),
    ).rejects.toThrow('index changed')
  })
})
