import assert from 'node:assert/strict'
import { it } from 'node:test'
import { parseSiteMarkdown } from '../src/utils/markdown'
import { mapMarkdownPartnerLists } from '../src/utils/markdown-partner-lists'
import { getPartnerTierGroupsForPlacement } from '../src/utils/partner-placement'

it('renders partner markers but leaves code examples alone', () => {
  const document = mapMarkdownPartnerLists(
    parseSiteMarkdown(
      '<partner-list></partner-list>\n\n<previous-partner-list></previous-partner-list>\n\n<start-partner-contributions></start-partner-contributions>\n\n```html\n<partner-list></partner-list>\n```',
    ),
  )
  assert.equal(document.children[0]?.type, 'component')
  assert.equal(document.children[1]?.type, 'component')
  assert.equal(document.children[2]?.type, 'component')
  assert.equal(document.children[3]?.type, 'code')
})

it('keeps tier order and reproduces the server order from serialized context', () => {
  const partners: Parameters<typeof getPartnerTierGroupsForPlacement>[0] = [
    { id: 'a', name: 'A', tier: 'bronze', category: 'deployment' },
    { id: 'b', name: 'B', tier: 'gold', category: 'deployment' },
    { id: 'c', name: 'C', tier: 'gold', category: 'deployment' },
    { id: 'd', name: 'D', tier: 'silver', category: 'deployment' },
  ]
  const context: Parameters<typeof getPartnerTierGroupsForPlacement>[1] = {
    orderStrategy: 'tier-rotated',
    rotationSeed: 'root-loader-seed',
  }
  const server = getPartnerTierGroupsForPlacement(partners, context)
  const client = getPartnerTierGroupsForPlacement(
    partners,
    JSON.parse(JSON.stringify(context)),
  )
  assert.deepEqual(
    server.map((group) => group.tier),
    ['gold', 'silver', 'bronze'],
  )
  assert.deepEqual(client, server)
})
