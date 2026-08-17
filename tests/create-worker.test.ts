import assert from 'node:assert/strict'
import { create } from '../src/builder/api/create-worker'

const react = await create.getFrameworkById('react')
if (!react) throw new Error('React framework not found')

const addOns = create.getAllAddOns(react, 'file-router')
const workos = addOns.find((addOn) => addOn.id === 'workos')
const sentry = addOns.find((addOn) => addOn.id === 'sentry')

if (!workos) throw new Error('WorkOS add-on not found')
if (!sentry) throw new Error('Sentry add-on not found')
assert.deepEqual(workos.partner, {
  id: 'workos',
  tier: 'silver',
})
assert.deepEqual(workos.packageAdditions?.engines, {
  node: '>=22.11.0',
})
assert.deepEqual(sentry.packageAdditions?.pnpm, {
  onlyBuiltDependencies: ['@sentry/cli'],
})

const [materializedWorkos] = await create.finalizeAddOns(react, 'file-router', [
  'workos',
])
assert.deepEqual(materializedWorkos?.partner, {
  id: 'workos',
  tier: 'silver',
})

console.log('create worker tests passed')
