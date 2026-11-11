import { PartnersVariant1Ledger } from './PartnersVariant1Ledger'
import { PartnersVariant2Pyramid } from './PartnersVariant2Pyramid'
import { PartnersVariant3Spotlight } from './PartnersVariant3Spotlight'
import { PartnersVariant4Wall } from './PartnersVariant4Wall'
import { PartnersVariant5Directory } from './PartnersVariant5Directory'
import { PartnersVariant6Stage } from './PartnersVariant6Stage'
import { PartnersVariant7Panel } from './PartnersVariant7Panel'

export const partnersVariantIds = [1, 2, 3, 4, 5, 6, 7] as const
export type PartnersVariant = (typeof partnersVariantIds)[number]

export const partnersVariants = {
  1: PartnersVariant1Ledger,
  2: PartnersVariant2Pyramid,
  3: PartnersVariant3Spotlight,
  4: PartnersVariant4Wall,
  5: PartnersVariant5Directory,
  6: PartnersVariant6Stage,
  7: PartnersVariant7Panel,
} satisfies Record<PartnersVariant, unknown>
