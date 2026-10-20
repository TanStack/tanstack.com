import assert from 'node:assert/strict'
import { create } from '../src/application-starter/api/create-worker'

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

const [materializedWorkos] = await create.finalizeAddOns(react, 'file-router', [
  'workos',
])
assert.deepEqual(materializedWorkos?.partner, {
  id: 'workos',
  tier: 'silver',
})

const [materializedSentry] = await create.finalizeAddOns(react, 'file-router', [
  'sentry',
])
assert.match(materializedSentry?.packageTemplate ?? '', /addOnEnabled\.vercel/)
assert.match(
  materializedSentry?.packageTemplate ?? '',
  /"onlyBuiltDependencies"/,
)

for (const frameworkId of ['react', 'solid']) {
  const framework = await create.getFrameworkById(frameworkId)
  if (!framework) throw new Error(`${frameworkId} framework not found`)

  const frameworkAddOns = create.getAllAddOns(framework, 'file-router')
  const codeRouterAddOnIds = create
    .getAllAddOns(framework, 'code-router')
    .map((addOn) => addOn.id)

  for (const deployment of ['render', 'vercel']) {
    const addOn = frameworkAddOns.find(
      (candidate) => candidate.id === deployment,
    )

    if (!addOn) {
      throw new Error(`${frameworkId} ${deployment} add-on not found`)
    }
    assert.deepEqual(addOn.partner, {
      id: deployment,
      tier: 'gold',
    })
    assert.deepEqual(addOn.modes, ['file-router'])
    assert.equal(codeRouterAddOnIds.includes(deployment), false)

    const [materializedDeployment] = await create.finalizeAddOns(
      framework,
      'file-router',
      [deployment],
    )

    if (deployment === 'render') {
      assert.match(
        materializedDeployment?.files['render.yaml.ejs'] ?? '',
        /BUN_VERSION/,
      )
    } else {
      assert.match(
        materializedDeployment?.files['vercel.json'] ?? '',
        /"framework": "tanstack-start"/,
      )
    }
  }
}

console.log('create worker tests passed')
