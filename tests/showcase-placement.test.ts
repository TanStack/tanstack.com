import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SHOWCASE_PLACEMENTS, SHOWCASE_STATUSES } from '../src/db/types'
import {
  isPublicShowcase,
  isCuratedShowcase,
  showcaseLinkRel,
} from '../src/utils/showcase.shared'

test('only accepted projects with a public placement can be published', () => {
  const publicStates = []
  const curatedStates = []
  for (const status of SHOWCASE_STATUSES) {
    for (const placement of SHOWCASE_PLACEMENTS) {
      const project = { status, placement }
      if (isPublicShowcase(project)) publicStates.push(`${status}/${placement}`)
      if (isCuratedShowcase(project))
        curatedStates.push(`${status}/${placement}`)
    }
  }
  assert.deepEqual(publicStates, ['approved/showcase', 'approved/community'])
  assert.deepEqual(curatedStates, ['approved/showcase'])
})

test('community and private preview links are qualified as user content', () => {
  for (const placement of ['community', 'private']) {
    const validated = SHOWCASE_PLACEMENTS.find((value) => value === placement)
    assert.ok(validated)
    assert.match(showcaseLinkRel({ placement: validated }), /ugc nofollow/)
  }
  assert.equal(
    showcaseLinkRel({ placement: 'showcase' }),
    'noopener noreferrer',
  )
})
