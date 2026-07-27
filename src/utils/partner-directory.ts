import * as v from 'valibot'

export type PartnerDirectoryStatus = 'active' | 'inactive'

const partnerDirectoryStatusSchema = v.picklist(['active', 'inactive'])

export const partnerDirectorySearchSchema = v.object({
  status: v.pipe(
    v.fallback(v.optional(partnerDirectoryStatusSchema, 'active'), 'active'),
    v.transform((status) => (status === 'active' ? undefined : status)),
  ),
})

export function normalizePartnerDirectorySearch(search: {
  status?: PartnerDirectoryStatus
}): {
  status: PartnerDirectoryStatus
} {
  return {
    status: search.status ?? 'active',
  }
}

export function getPartnerDirectorySearch(status: PartnerDirectoryStatus): {
  status: 'inactive' | undefined
} {
  return {
    status: status === 'inactive' ? 'inactive' : undefined,
  }
}

export function getPartnerDirectoryMetadata(status: PartnerDirectoryStatus) {
  return status === 'inactive'
    ? {
        title: 'Previous TanStack Partners',
        description:
          'Companies and organizations that previously supported TanStack and its open source projects.',
      }
    : {
        title: 'TanStack Partners',
        description:
          'Companies and organizations supporting TanStack and its open source projects.',
      }
}
