import { z } from 'zod'
import {
  kodyCommunityDetailSchema,
  kodyCommunityListingIdSchema,
  kodyCommunitySearchInputSchema,
  kodyCommunitySearchSchema,
} from '../core/kody-community'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export class KodyCommunityError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyCommunityError'
  }
}

const listingProjection = `({
  listingId: listing.listing_id,
  name: listing.name,
  description: listing.description,
  category: listing.category,
  version: listing.version ?? null,
  publicUrl: listing.public_url,
  forkCount: listing.fork_count,
  rating: listing.average_stars ?? null,
})`

export const KODY_COMMUNITY_SEARCH_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const result = await kody.communitySearch({
    query: params.query,
    category: params.category,
    sort: params.sort,
    limit: 30,
  })
  return {
    outcome: result.outcome,
    items: result.matches.map(listing => ${listingProjection}),
  }
}`

export const KODY_COMMUNITY_GET_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const listing = await kody.communityGet({ listing_id: params.listingId })
  if (!listing) return null
  return {
    ...${listingProjection},
    status: listing.status,
    pinnedCommit: listing.pinned_commit,
    readme: listing.readme_untrusted ?? '',
  }
}`

function result(raw: unknown) {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyCommunityError('Kody packages could not be read.')
  return envelope.data.structuredContent.result
}

export function projectKodyCommunitySearch(raw: unknown) {
  const parsed = kodyCommunitySearchSchema.safeParse(result(raw))
  if (!parsed.success)
    throw new KodyCommunityError('Kody returned an unsupported package list.')
  return parsed.data
}

export function projectKodyCommunityDetail(raw: unknown, listingId: string) {
  const value = result(raw)
  if (value === null)
    throw new KodyCommunityError('Package was not found in Kody.', 404)
  const parsed = kodyCommunityDetailSchema.safeParse(value)
  if (!parsed.success || parsed.data.listingId !== listingId)
    throw new KodyCommunityError('Kody returned an unsupported package.')
  return parsed.data
}

async function read(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  code: string,
  params: Record<string, unknown>,
  signal: AbortSignal,
  call: typeof kodyCall,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyCommunityError(
      before.reason === 'blocked'
        ? 'Kody is disabled in this workspace.'
        : 'Connect Kody to browse packages.',
      409,
    )
  try {
    const response = await call(
      env,
      scope.userId,
      'execute',
      kodyInternalReadArgs({ code, params, responseLimit: 100000 }),
      signal,
    )
    await assertKodyReferenceAccountUnchanged(env, scope, options, before)
    return response
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyCommunityError(error.message, 409)
    if (
      error instanceof Error &&
      error.message === 'Kody connection or access changed. Try again.'
    )
      throw new KodyCommunityError(error.message, 409)
    if (error instanceof KodyCommunityError) throw error
    throw new KodyCommunityError(
      'Kody packages could not be checked right now.',
    )
  }
}

export async function searchKodyCommunity(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  input: unknown,
  signal: AbortSignal,
) {
  const params = kodyCommunitySearchInputSchema.parse(input)
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled)
    throw new KodyCommunityError('Connect Kody to browse packages.', 409)
  const url = new URL('https://kody.codes/community.json')
  url.searchParams.set('q', params.query)
  url.searchParams.set('sort', params.sort)
  url.searchParams.set('limit', '100')
  if (params.category) url.searchParams.set('category', params.category)
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok)
    throw new KodyCommunityError('Kody packages could not be loaded.')
  const value = projectPublicKodyCatalog(await response.json())
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  return value
}

export async function getKodyCommunityListing(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  listingId: string,
  signal: AbortSignal,
  call: typeof kodyCall = kodyCall,
) {
  const input = kodyCommunityListingIdSchema.parse(listingId)
  return projectKodyCommunityDetail(
    await read(
      env,
      scope,
      options,
      KODY_COMMUNITY_GET_CODE,
      { listingId: input },
      signal,
      call,
    ),
    input,
  )
}

const publicListingSchema = z.object({
  id: kodyCommunityListingIdSchema,
  name: z.string(),
  description: z.string(),
  category: z.string(),
  iconUrl: z.string(),
  tags: z.array(z.string()),
  version: z.string().nullish(),
  publishedAt: z.string(),
  averageStars: z.number().nullable(),
  ratingCount: z.number(),
  averageAdaptationEffort: z.number().nullable(),
  forkCount: z.number(),
})
export function projectPublicKodyCatalog(raw: unknown) {
  const data = z
    .object({
      ok: z.literal(true),
      listings: z.array(publicListingSchema).max(100),
      categoryCounts: z.record(z.string(), z.number().int().nonnegative()),
    })
    .parse(raw)
  return kodyCommunitySearchSchema.parse({
    outcome: data.listings.length ? 'matches' : 'no_matches',
    categoryCounts: data.categoryCounts,
    items: data.listings.map((item) => ({
      listingId: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      version: item.version ?? null,
      publicUrl: `https://kody.codes/community/${item.id}`,
      iconUrl: new URL(item.iconUrl, 'https://kody.codes').href,
      tags: item.tags,
      publishedAt: item.publishedAt,
      rating: item.averageStars,
      ratingCount: item.ratingCount,
      effort: item.averageAdaptationEffort,
      forkCount: item.forkCount,
    })),
  })
}
