import OpenSourceStats, {
  type HomepageStatsSnapshot,
} from '~/components/OpenSourceStats'

export function HomeStatsSection({
  className,
  initialStats,
}: {
  className?: string
  initialStats: HomepageStatsSnapshot
}) {
  return (
    <OpenSourceStats
      className={className}
      page="hero"
      initialStats={initialStats}
    />
  )
}
