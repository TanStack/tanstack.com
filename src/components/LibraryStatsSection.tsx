import OpenSourceStats from '~/components/OpenSourceStats'
import type { Library } from '~/libraries'

interface LibraryStatsSectionProps {
  library: Library
}

export function LibraryStatsSection({ library }: LibraryStatsSectionProps) {
  return (
    <div className="w-fit mx-auto px-4">
      <OpenSourceStats library={library} />
    </div>
  )
}
