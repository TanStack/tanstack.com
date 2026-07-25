import assert from 'node:assert/strict'
import {
  getPartnerWindowLabel,
  type PartnerLifecycle,
} from '../src/utils/partner-lifecycle'

const basePartner: PartnerLifecycle = {
  status: 'inactive',
  startDate: 'Jan 2026',
  endDate: null,
}

assert.equal(
  getPartnerWindowLabel(basePartner),
  'Jan 2026 - End date unknown',
  'inactive partners must label an unknown end date',
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
  getPartnerWindowLabel({
    status: 'inactive',
    startDate: null,
    endDate: 'Jun 2026',
  }),
  'Start date unknown - Jun 2026',
  'inactive partners must label an unknown start date',
)

assert.equal(
  getPartnerWindowLabel({
    status: 'inactive',
    startDate: null,
    endDate: null,
  }),
  'Dates unavailable',
  'fully unknown partner windows remain explicit',
)

console.log('partner page tests passed')
