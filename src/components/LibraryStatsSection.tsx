import OpenSourceStats from '~/components/OpenSourceStats'
import type { Library } from '~/libraries'

interface LibraryStatsSectionProps {
  library: Library
}

export function LibraryStatsSection({ library }: LibraryStatsSectionProps) {
  return (
    <div className="mx-auto w-full max-w-[1021px] px-4 sm:px-6">
      <div className="mx-auto w-fit">
        <OpenSourceStats library={library} />
      </div>
    </div>
  )
}
