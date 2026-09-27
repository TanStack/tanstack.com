import type { Partner, PartnerTier } from '~/utils/partners'

export const partnerPlacementOrderStrategies = [
  'static-curated',
  'tier-rotated',
  'contextual-recommendation',
  'machine-readable',
] as const

export type PartnerPlacementOrderStrategy =
  (typeof partnerPlacementOrderStrategies)[number]

export type PartnerPlacementContext = {
  category?: Partner['category']
  orderStrategy: PartnerPlacementOrderStrategy
  rotationSeed?: string
}

export type PartnerPlacementAnalyticsMetadata = {
  order_strategy: PartnerPlacementOrderStrategy
  partner_tier: PartnerTier
  rotation_seed?: string
}

type PartnerForPlacement = Pick<
  Partner,
  'category' | 'id' | 'name' | 'tier'
> & {
  placementWeight?: number
}

const partnerPlacementTiers = [
  'gold',
  'silver',
  'bronze',
] as const satisfies ReadonlyArray<PartnerTier>

const partnerTierPlacementOrder = {
  gold: 0,
  silver: 1,
  bronze: 2,
} satisfies Record<PartnerTier, number>

function getPartnerTier(partner: Pick<Partner, 'tier'>): PartnerTier {
  return partner.tier ?? 'bronze'
}

export function createPartnerPlacementSessionSeed() {
  const crypto = globalThis.crypto

  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }

  if (crypto?.getRandomValues) {
    const values = new Uint32Array(4)
    crypto.getRandomValues(values)
    return Array.from(values, (value) => value.toString(36)).join('')
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

export function getPartnerViewPlacementSeed(
  surface: string,
  sessionSeed: string,
) {
  return `${surface}:${sessionSeed}`
}

export function getPartnerPlacementContext({
  category,
  orderStrategy,
  seed,
  surface,
}: {
  category?: Partner['category']
  orderStrategy: PartnerPlacementOrderStrategy
  seed?: string
  surface: string
}): PartnerPlacementContext {
  return {
    category,
    orderStrategy,
    rotationSeed:
      orderStrategy === 'tier-rotated' ? (seed ?? surface) : undefined,
  }
}

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function comparePartnerIdentity(
  left: Pick<Partner, 'id' | 'name'>,
  right: Pick<Partner, 'id' | 'name'>,
) {
  const nameComparison = left.name.localeCompare(right.name)

  if (nameComparison !== 0) {
    return nameComparison
  }

  return left.id.localeCompare(right.id)
}

function compareLegacyPartnerPriority<TPartner extends PartnerForPlacement>(
  left: TPartner,
  right: TPartner,
) {
  return comparePartnerIdentity(left, right)
}

function compareSeededPartnerOrder<TPartner extends PartnerForPlacement>(
  left: TPartner,
  right: TPartner,
  seed: string,
) {
  const leftWeight =
    typeof left.placementWeight === 'number' && left.placementWeight > 0
      ? left.placementWeight
      : 1
  const rightWeight =
    typeof right.placementWeight === 'number' && right.placementWeight > 0
      ? right.placementWeight
      : 1
  const leftRandom = (hashString(`${seed}:${left.id}`) + 1) / 4294967297
  const rightRandom = (hashString(`${seed}:${right.id}`) + 1) / 4294967297
  const leftRank = -Math.log(leftRandom) / leftWeight
  const rightRank = -Math.log(rightRandom) / rightWeight
  const seededComparison = leftRank - rightRank

  if (seededComparison !== 0) {
    return seededComparison
  }

  return comparePartnerIdentity(left, right)
}

export function comparePartnersForPlacement<
  TPartner extends PartnerForPlacement,
>(left: TPartner, right: TPartner, context: PartnerPlacementContext) {
  const tierComparison =
    partnerTierPlacementOrder[getPartnerTier(left)] -
    partnerTierPlacementOrder[getPartnerTier(right)]

  if (tierComparison !== 0) {
    return tierComparison
  }

  if (context.orderStrategy === 'tier-rotated' && context.rotationSeed) {
    return compareSeededPartnerOrder(left, right, context.rotationSeed)
  }

  return compareLegacyPartnerPriority(left, right)
}

export function getPartnersForPlacement<TPartner extends PartnerForPlacement>(
  partners: Array<TPartner>,
  context: PartnerPlacementContext,
) {
  return [...partners].sort((left, right) =>
    comparePartnersForPlacement(left, right, context),
  )
}

export function getPartnerTierGroupsForPlacement<
  TPartner extends PartnerForPlacement,
>(partners: Array<TPartner>, context: PartnerPlacementContext) {
  return partnerPlacementTiers
    .map((tier) => ({
      tier,
      partners: getPartnersForPlacement(
        partners.filter((partner) => getPartnerTier(partner) === tier),
        context,
      ),
    }))
    .filter((group) => group.partners.length > 0)
}

export function getPartnerPlacementAnalyticsMetadata(
  partner: PartnerForPlacement,
  context: PartnerPlacementContext,
): PartnerPlacementAnalyticsMetadata {
  return {
    order_strategy: context.orderStrategy,
    partner_tier: getPartnerTier(partner),
    rotation_seed: context.rotationSeed,
  }
}
