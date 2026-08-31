import OpenSourceStats from '~/components/OpenSourceStats'

export function HomeStatsSection({ className }: { className?: string }) {
  return <OpenSourceStats className={className} page="hero" />
}
