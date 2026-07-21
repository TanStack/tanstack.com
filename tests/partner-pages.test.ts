import assert from 'node:assert/strict'
import {
  getPartnerWindowLabel,
  type PartnerLifecycle,
} from '../src/utils/partner-lifecycle'

const basePartner = {
  status: 'inactive',
  startDate: 'Jan 2026',
} satisfies PartnerLifecycle

assert.equal(
  getPartnerWindowLabel(basePartner),
  'Started Jan 2026',
  'inactive partners without a known end date must not render as present',
)

assert.equal(
  getPartnerWindowLabel({ ...basePartner, status: 'active' }),
  'Jan 2026 - Present',
  'active partners without an end date render as present',
)

assert.equal(
  getPartnerWindowLabel({ ...basePartner, endDate: 'Jun 2026' }),
  'Jan 2026 - Jun 2026',
  'known partner windows include both dates',
)

assert.equal(
  getPartnerWindowLabel({ status: 'inactive', endDate: 'Jun 2026' }),
  'Ended Jun 2026',
  'end-only partner windows still communicate when the relationship ended',
)

console.log('partner page tests passed')
