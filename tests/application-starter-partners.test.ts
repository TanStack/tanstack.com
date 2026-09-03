import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import type { PartnerPlacement } from '../src/utils/analytics'

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
  getPartnerHref,
  partners,
}: typeof import('../src/utils/partners') = require('../src/utils/partners')
const {
  TEMPLATES,
}: typeof import('../src/application-starter/templates') = require('../src/application-starter/templates')
const {
  getPartnerSitemapEntries,
}: typeof import('../src/utils/partner-pages') = require('../src/utils/partner-pages')
const {
  createRailwayPartnerPageModel,
  getRailwayPartnerPageModel,
}: typeof import('../src/utils/railway-partner') = require('../src/utils/railway-partner')
const {
  createVercelPartnerPageModel,
  getVercelPartnerPageModel,
}: typeof import('../src/utils/vercel-partner') = require('../src/utils/vercel-partner')
const {
  getStartHostingPartners,
}: typeof import('../src/utils/start-hosting-partners') = require('../src/utils/start-hosting-partners')
const {
  getPartnerPlacementContext,
  getPartnerTierGroupsForPlacement,
}: typeof import('../src/utils/partner-placement') = require('../src/utils/partner-placement')
const {
  addOn: reactRailwayAddOn,
}: typeof import('@tanstack/create/worker-manifest/frameworks/react/add-ons/railway') = require('@tanstack/create/worker-manifest/frameworks/react/add-ons/railway')
const {
  addOn: reactVercelAddOn,
}: typeof import('@tanstack/create/worker-manifest/frameworks/react/add-ons/vercel') = require('@tanstack/create/worker-manifest/frameworks/react/add-ons/vercel')

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

test('partner records have stable ids and explicit lifecycle data', () => {
  const partnerIds = new Set<string>()

  for (const partner of partners) {
    assert.match(partner.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.equal(
      partnerIds.has(partner.id),
      false,
      `duplicate id: ${partner.id}`,
    )
    partnerIds.add(partner.id)

    if (partner.status === 'inactive') {
      assert.equal(Object.hasOwn(partner, 'startDate'), true)
      assert.equal(Object.hasOwn(partner, 'endDate'), true)
    }
  }
})

test('active partner reviews stay fresh', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const maximumReviewAgeMs = 120 * dayMs
  const now = Date.now()

  for (const partner of partners) {
    if (partner.status !== 'active') continue

    const reviewedAt = Date.parse(`${partner.lastReviewedAt}T12:00:00.000Z`)
    assert.equal(Number.isNaN(reviewedAt), false)
    assert.ok(
      reviewedAt <= now + dayMs,
      `${partner.id} review is in the future`,
    )
    assert.ok(
      now - reviewedAt <= maximumReviewAgeMs,
      `${partner.id} review is more than 120 days old`,
    )
  }
})

test('internal partner resources point at matching TanStack content', () => {
  for (const partner of partners) {
    for (const resource of partner.resources ?? []) {
      if (!resource.href.startsWith('/')) {
        assert.doesNotThrow(() => new URL(resource.href))
        continue
      }

      const url = new URL(resource.href, 'https://tanstack.com')
      assert.equal(url.origin, 'https://tanstack.com')

      if (url.pathname.startsWith('/blog/')) {
        const slug = url.pathname.slice('/blog/'.length)
        assert.ok(
          existsSync(new URL(`../src/blog/${slug}.md`, import.meta.url)),
          `${partner.id} references missing blog post ${url.pathname}`,
        )
        continue
      }

      assert.match(url.pathname, /^\/[^/]+\/latest\/docs\//)
      const libraryId = url.pathname.split('/')[1]
      const relatedProductIds = new Set<string>(partner.relatedProducts ?? [])
      assert.ok(
        libraryId && relatedProductIds.has(libraryId),
        `${partner.id} resource ${url.pathname} does not match a related product`,
      )
    }
  }
})

test('partner sitemap exposes both directory states and every detail page', () => {
  const entries = getPartnerSitemapEntries()
  const paths = entries.map((entry) => entry.path)

  assert.equal(new Set(paths).size, paths.length)
  assert.ok(paths.includes('/partners'))
  assert.ok(paths.includes('/partners?status=inactive'))

  for (const partner of partners) {
    assert.ok(paths.includes(`/partners/${partner.id}`))
  }
})

test('custom Railway page derives its partner contract from central data', () => {
  const model = getRailwayPartnerPageModel()
  const { create, docsResource, partner } = model
  const centralPartner = partners.find(
    (candidate) => candidate.id === 'railway',
  )

  assert.equal(partner, centralPartner)
  assert.ok(partner)
  assert.equal(centralPartner?.category, 'deployment')
  assert.ok(centralPartner?.resources?.includes(docsResource))
  assert.equal(create.deploymentId, reactRailwayAddOn.id)
  assert.equal(reactRailwayAddOn.partner.id, partner.id)
  assert.equal(
    create.command,
    `npx @tanstack/cli@latest create my-tanstack-app --deployment ${reactRailwayAddOn.id}`,
  )

  const previousModel = createRailwayPartnerPageModel({
    ...partner,
    status: 'inactive',
    startDate: null,
    endDate: null,
    tier: undefined,
  })

  assert.equal(previousModel.partner.status, 'inactive')
  assert.equal(previousModel.partner.tier, undefined)
  assert.equal(previousModel.docsResource, docsResource)
})

test('custom Vercel page derives its partner contract from central data', () => {
  const model = getVercelPartnerPageModel()
  const { create, docsResource, partner } = model
  const centralPartner = partners.find((candidate) => candidate.id === 'vercel')

  assert.equal(partner, centralPartner)
  assert.ok(partner)
  assert.equal(centralPartner?.category, 'deployment')
  assert.ok(centralPartner?.resources?.includes(docsResource))
  assert.equal(create.deploymentId, reactVercelAddOn.id)
  assert.equal(reactVercelAddOn.partner.id, partner.id)
  assert.equal(
    create.command,
    `npx @tanstack/cli@latest create my-tanstack-app --deployment ${reactVercelAddOn.id}`,
  )

  const previousModel = createVercelPartnerPageModel({
    ...partner,
    status: 'inactive',
    startDate: null,
    endDate: null,
    tier: undefined,
  })

  assert.equal(previousModel.partner.status, 'inactive')
  assert.equal(previousModel.partner.tier, undefined)
  assert.equal(previousModel.docsResource, docsResource)
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
    withoutHosted.advancedApplicationStarterUrl ?? '',
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

test('selected Vercel partner uses the Vercel deployment target', async () => {
  const input = composeApplicationStarterInput(
    'Build a full-stack app.',
    ['vercel'],
    [],
  )
  const result = await resolveApplicationStarterDeterministically({
    context: 'home',
    input,
  })

  assert.equal(result.recipe.deployment, 'vercel')
  assert.match(result.cliCommand, /--deployment vercel/)
})

test('selected Render partner uses the Render deployment target', async () => {
  const input = composeApplicationStarterInput(
    'Build a full-stack app.',
    ['render'],
    [],
  )
  const result = await resolveApplicationStarterDeterministically({
    context: 'home',
    input,
  })

  assert.equal(result.recipe.deployment, 'render')
  assert.match(result.cliCommand, /--deployment render/)
})

test('hosting names infer their matching partner and deployment target', async () => {
  for (const hosting of [
    { id: 'render', name: 'Render' },
    { id: 'vercel', name: 'Vercel' },
  ]) {
    const input = `Build a full-stack app and deploy to ${hosting.name}.`
    const inferredPartnerIds =
      getInferredApplicationStarterPartnerIdsFromUserInput(input, [])
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assert.ok(inferredPartnerIds.includes(hosting.id))
    assert.equal(result.recipe.deployment, hosting.id)
    assert.match(result.cliCommand, new RegExp(`--deployment ${hosting.id}`))
  }
})

test('ordinary rendering language does not select Render hosting', async () => {
  for (const input of [
    'Render a chart with server data.',
    'Server render this page before hydration.',
    'Deploy a canvas app that uses WebGL to render charts.',
  ]) {
    const inferredPartnerIds =
      getInferredApplicationStarterPartnerIdsFromUserInput(input, [])
    const result = await resolveApplicationStarterDeterministically({
      context: 'home',
      input,
    })

    assert.equal(inferredPartnerIds.includes('render'), false)
    assert.notEqual(result.recipe.deployment, 'render')
    assert.doesNotMatch(result.cliCommand, /--deployment render/)
  }
})

test('Render uses per-placement UTM content for approved surfaces', () => {
  const renderPartner = partners.find((p) => p.id === 'render')
  assert.ok(renderPartner, 'Render partner should exist')

  const placements: PartnerPlacement[] = [
    'home_grid',
    'library_grid',
    'docs_rail',
    'docs_strip',
  ]
  for (const placement of placements) {
    const href = getPartnerHref(renderPartner, placement)
    assert.match(
      href,
      new RegExp(`utm_content=${placement}`),
      `Render href for ${placement} should include utm_content=${placement}`,
    )
    assert.match(href, /render\.com/, 'Should point to render.com')
    assert.match(href, /utm_source=tanstack/, 'Should include utm_source')
    assert.match(
      href,
      /utm_campaign=gold-launch/,
      'Should include utm_campaign',
    )
  }

  const defaultHref = getPartnerHref(renderPartner, 'directory')
  assert.doesNotMatch(
    defaultHref,
    /utm_content/,
    'Render href for other placements should not include utm_content',
  )
})

test('other partners use their default href regardless of placement', () => {
  const vercel = partners.find((p) => p.id === 'vercel')
  assert.ok(vercel, 'Vercel partner should exist')

  const placements: PartnerPlacement[] = [
    'home_grid',
    'library_grid',
    'docs_rail',
    'docs_strip',
    'directory',
  ]
  for (const placement of placements) {
    const href = getPartnerHref(vercel, placement)
    assert.equal(
      href,
      vercel.href,
      `Vercel href should be unchanged for ${placement}`,
    )
  }
})

test('Vercel and Render rotate with the gold Start hosting partners', () => {
  const hostingPartners = getStartHostingPartners()

  for (const partnerId of ['vercel', 'render']) {
    const partner = hostingPartners.find(
      (candidate) => candidate.id === partnerId,
    )

    assert.ok(partner)
    assert.equal(partner.tier, 'gold')
  }

  const positions = new Map([
    ['vercel', new Set<number>()],
    ['render', new Set<number>()],
  ])

  for (let seedIndex = 0; seedIndex < 32; seedIndex++) {
    const context = getPartnerPlacementContext({
      category: 'deployment',
      orderStrategy: 'tier-rotated',
      seed: `start-hosting-test-${seedIndex}`,
      surface: 'docs_strip',
    })
    const goldPartners = getPartnerTierGroupsForPlacement(
      hostingPartners,
      context,
    ).find((group) => group.tier === 'gold')?.partners

    assert.ok(goldPartners)
    for (const [partnerId, partnerPositions] of positions) {
      const position = goldPartners.findIndex(
        (partner) => partner.id === partnerId,
      )
      assert.notEqual(position, -1)
      partnerPositions.add(position)
    }
  }

  for (const partnerPositions of positions.values()) {
    assert.ok(partnerPositions.size > 1)
  }
})
