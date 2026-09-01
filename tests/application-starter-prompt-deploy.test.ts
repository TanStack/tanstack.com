import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStarterPromptDeployUrl,
  getStarterPromptBuildLabel,
} from '../src/components/application-starter/prompt-deploy'

test('prompt handoffs use build labels', () => {
  assert.equal(getStarterPromptBuildLabel('lovable'), 'Build with Lovable')
  assert.equal(getStarterPromptBuildLabel('netlify'), 'Build with Netlify')
  assert.equal(getStarterPromptBuildLabel('v0'), 'Build with v0')
})

test('v0 handoff preserves the generated prompt', () => {
  const prompt = 'Build a café dashboard\nwith revenue in €'
  const url = new URL(buildStarterPromptDeployUrl('v0', prompt))

  assert.equal(url.origin, 'https://v0.app')
  assert.equal(url.pathname, '/')
  assert.equal(url.searchParams.get('q'), prompt)
  assert.equal(url.searchParams.get('utm_source'), 'tanstack')
})

test('Netlify handoff preserves the generated prompt', () => {
  const prompt = 'Build a café dashboard\nwith revenue in €'
  const url = new URL(buildStarterPromptDeployUrl('netlify', prompt))

  assert.equal(url.origin, 'https://app.netlify.com')
  assert.equal(url.pathname, '/start')
  assert.equal(url.searchParams.get('prompt'), prompt)
  assert.equal(url.searchParams.get('utm_source'), 'tanstack')
})

test('Lovable handoff preserves the generated prompt', () => {
  const prompt = 'Build a café dashboard\nwith revenue in €'
  const url = new URL(buildStarterPromptDeployUrl('lovable', prompt))
  const hash = new URLSearchParams(url.hash.slice(1))

  assert.equal(url.origin, 'https://lovable.dev')
  assert.equal(url.pathname, '/')
  assert.equal(url.searchParams.get('autosubmit'), 'true')
  assert.equal(url.searchParams.get('utm_source'), 'tanstack')
  assert.equal(hash.get('prompt'), prompt)
})
