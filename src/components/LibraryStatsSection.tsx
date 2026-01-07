import OpenSourceStats from '~/components/OpenSourceStats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'
import type { Library } from '~/libraries'

interface LibraryStatsSectionProps {
  library: Library
}

export function LibraryStatsSection({ library }: LibraryStatsSectionProps) {
  return (
    <>
      <div className="w-fit mx-auto px-4">
        <OpenSourceStats library={library} />
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>
    </>
  )
}
