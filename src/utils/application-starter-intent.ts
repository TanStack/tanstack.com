import { z } from 'zod'

export const applicationStarterPartnerIntentSchema = z.object({
  eligiblePartnerIds: z.array(z.string()),
  preferredPartnerIds: z.array(z.string()),
  excludedPartnerIds: z.array(z.string()),
})

export type ApplicationStarterPartnerIntent = z.infer<
  typeof applicationStarterPartnerIntentSchema
>

// Keep the supplied placement order. Inference determines eligibility, never rank.
export function selectIntentPartners({
  intent,
  partners,
  selections,
}: {
  intent: ApplicationStarterPartnerIntent | null
  partners: Array<{
    id: string
    category: string
    uniqueConstraints: Array<string>
  }>
  selections: Record<string, boolean>
}) {
  const selected = partners.filter((partner) => selections[partner.id] === true)
  const inferred: Array<string> = []
  if (!intent) return inferred

  const candidates = [
    ...partners.filter((partner) =>
      intent.preferredPartnerIds.includes(partner.id),
    ),
    ...partners.filter((partner) =>
      intent.eligiblePartnerIds.includes(partner.id),
    ),
  ]
  for (const partner of candidates) {
    if (
      selections[partner.id] !== undefined ||
      intent.excludedPartnerIds.includes(partner.id) ||
      selected.some(
        (other) =>
          other.category === partner.category ||
          other.uniqueConstraints.some((constraint) =>
            partner.uniqueConstraints.includes(constraint),
          ),
      )
    )
      continue
    selected.push(partner)
    inferred.push(partner.id)
  }
  return inferred
}
