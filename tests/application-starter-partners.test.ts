import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const loadAsset: NodeJS.RequireExtensions[string] = (module, filename) => {
  module.exports = filename
}

require.extensions['.png'] = loadAsset
require.extensions['.svg'] = loadAsset

const {
  resolveApplicationStarterDeterministically,
}: typeof import('../src/utils/application-starter') = require('../src/utils/application-starter')
const {
  composeApplicationStarterInput,
  getInferredApplicationStarterPartnerIdsFromUserInput,
  partners,
}: typeof import('../src/utils/partners') = require('../src/utils/partners')
const {
  TEMPLATES,
}: typeof import('../src/builder/templates') = require('../src/builder/templates')

const formerPartnerFeatures = ['convex', 'neon', 'strapi']

test('active partner records include the audit contract', () => {
  for (const partner of partners) {
    if (partner.status !== 'active') continue

    assert.match(partner.lastReviewedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(partner.canonicalHref, /^https:\/\//)
    assert.ok(partner.resources.length > 0)
    assert.equal(Object.hasOwn(partner, 'libraries'), false)
  }
})

function assertDoesNotDefaultToFormerPartners(features: Array<string>) {
  for (const feature of formerPartnerFeatures) {
    assert.equal(features.includes(feature), false)
  }
}

test('starter recipes do not silently select former partners', async () => {
  const prompts = [
    'Build a SaaS app with auth and a database.',
    'Build a content site backed by a CMS.',
    'Build a realtime collaborative app.',
    'Migrate an existing Next.js app.',
  ]

  for (const input of prompts) {
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assertDoesNotDefaultToFormerPartners(result.recipe.features)
  }
})

test('starter recipes do not silently select unsafe monitoring defaults', async () => {
  for (const input of [
    'Build a SaaS app with auth and a database.',
    'Build a full-stack TanStack Start app with auth, database access, and forms.',
    'Build a product app with authentication, Postgres, and forms. Use pnpm.',
    'Migrate an existing Next.js app.',
  ]) {
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assert.equal(result.recipe.features.includes('sentry'), false)
  }
})

test('generic auth and monitoring requests do not infer vendor partners', async () => {
  for (const { input, excludedPartners } of [
    {
      input: 'Build an app with authentication.',
      excludedPartners: ['clerk', 'workos'],
    },
    {
      input: 'Build an app with error tracking and observability.',
      excludedPartners: ['sentry'],
    },
  ]) {
    const inferredPartners =
      getInferredApplicationStarterPartnerIdsFromUserInput(input, [])
    const composedInput = composeApplicationStarterInput(
      input,
      [],
      inferredPartners,
    )
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input: composedInput,
    })

    for (const partnerId of excludedPartners) {
      assert.equal(inferredPartners.includes(partnerId), false)
      assert.equal(result.recipe.features.includes(partnerId), false)
    }
  }
})

test('selected auth partners survive generic auth language', async () => {
  for (const partnerId of ['clerk', 'workos']) {
    const input = composeApplicationStarterInput(
      'Build an app with authentication.',
      [partnerId],
      [],
    )
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assert.ok(result.recipe.features.includes(partnerId))
    assert.equal(result.recipe.features.includes('better-auth'), false)
  }
})

test('starter presets do not silently select former partners', () => {
  for (const template of TEMPLATES) {
    assertDoesNotDefaultToFormerPartners(template.features)
  }

  assert.ok(
    TEMPLATES.find((template) => template.id === 'saas')?.features.includes(
      'prisma',
    ),
  )
  assert.ok(
    TEMPLATES.find((template) => template.id === 'realtime')?.features.includes(
      'db',
    ),
  )
})

test('Prisma and Drizzle no longer pull in Neon', async () => {
  for (const input of [
    'Build an app with Prisma.',
    'Build an app with Drizzle.',
  ]) {
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assert.equal(result.recipe.features.includes('neon'), false)
  }
})

test('database constraints survive starter defaults and inference', async () => {
  const withoutHosted = await resolveApplicationStarterDeterministically({
    context: 'home',
    input: 'Build a SaaS app without a hosted database.',
  })
  assert.ok(withoutHosted.recipe.features.includes('prisma'))
  assert.deepEqual(withoutHosted.recipe.featureOptions.prisma, {
    database: 'sqlite',
  })
  assert.match(withoutHosted.cliCommand, /prisma/)
  assert.match(withoutHosted.cliCommand, /database.*sqlite/)
  assert.match(
    withoutHosted.advancedBuilderUrl ?? '',
    /prisma\.database=sqlite/,
  )
  assert.match(withoutHosted.downloadUrl ?? '', /prisma\.database=sqlite/)

  const withoutDatabase = await resolveApplicationStarterDeterministically({
    context: 'home',
    input: 'Build a SaaS app without a database.',
  })
  for (const feature of ['convex', 'db', 'drizzle', 'neon', 'prisma']) {
    assert.equal(withoutDatabase.recipe.features.includes(feature), false)
  }

  const withoutPrisma = await resolveApplicationStarterDeterministically({
    context: 'home',
    input: 'Build a SaaS app without Prisma.',
  })
  assert.equal(withoutPrisma.recipe.features.includes('prisma'), false)
  assert.ok(withoutPrisma.recipe.features.includes('drizzle'))

  const withoutTanStackDb = await resolveApplicationStarterDeterministically({
    context: 'home',
    input: 'Build a realtime collaborative app without TanStack DB.',
  })
  assert.equal(withoutTanStackDb.recipe.features.includes('db'), false)
})

test('an explicitly selected Prisma integration survives realtime inference', async () => {
  const input = composeApplicationStarterInput(
    'Build a realtime collaborative app.',
    ['prisma'],
    [],
  )
  const result = await resolveApplicationStarterDeterministically({
    context: 'home',
    input,
  })

  assert.ok(result.recipe.features.includes('prisma'))
  assert.equal(result.recipe.features.includes('neon'), false)
})

test('former partner integrations remain available when explicitly requested', async () => {
  for (const feature of formerPartnerFeatures) {
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input: `Build an app with ${feature}.`,
    })

    assert.ok(result.recipe.features.includes(feature))
  }
})

test('OpenRouter guidance prefers the TanStack AI adapter', async () => {
  const input = composeApplicationStarterInput(
    'Build an AI chat app with TanStack AI.',
    ['openrouter'],
    [],
  )
  const result = await resolveApplicationStarterDeterministically({
    context: 'home',
    input,
  })

  assert.match(result.prompt, /@tanstack\/ai-openrouter/)
})
