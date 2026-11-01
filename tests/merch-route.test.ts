import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(
  new URL('../src/routes/merch.tsx', import.meta.url),
  'utf8',
)

test('/merch permanently redirects to the Shopify shop', () => {
  assert.match(source, /redirect\(\{\s*to:\s*'\/shop'/)
  assert.match(source, /statusCode:\s*308/)
})

test('/merch no longer sends shoppers to Cotton Bureau or Sticker Mule', () => {
  assert.equal(/cottonbureau/i.test(source), false)
  assert.equal(/stickermule/i.test(source), false)
  assert.equal(/sold at cost/i.test(source), false)
  assert.equal(/no profit/i.test(source), false)
})
