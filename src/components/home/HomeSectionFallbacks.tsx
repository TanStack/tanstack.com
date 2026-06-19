import { Card } from '~/components/Card'

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <h3 id={id} className="text-3xl font-bold mb-6 scroll-mt-24">
      <a
        href={`#${id}`}
        className="hover:underline decoration-gray-400 dark:decoration-gray-600"
      >
        {title}
      </a>
    </h3>
  )
}

function SectionBlock({ className }: { className?: string }) {
  return (
    <Card
      aria-hidden="true"
      className={`animate-pulse overflow-hidden ${className ?? 'min-h-[220px]'}`}
    >
      <div className="h-full w-full bg-linear-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900" />
    </Card>
  )
}

export function HomeSocialProofFallback() {
  return (
    <div className="space-y-24 min-h-[1840px] md:min-h-[1260px] lg:min-h-[1180px]">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <SectionTitle id="partners" title="Partners" />
        <SectionBlock className="min-h-[360px] md:min-h-[240px]" />
      </div>

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-900" />
        </div>
        <div className="mt-8">
          <SectionBlock className="min-h-[420px] md:min-h-[360px]" />
        </div>
      </div>

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <SectionTitle id="blog" title="Latest Blog Posts" />
        <SectionBlock className="min-h-[420px] md:min-h-[320px]" />
      </div>
    </div>
  )
}

export function HomeCommunityFallback() {
  return (
    <div className="space-y-24 min-h-[1180px] md:min-h-[780px] lg:min-h-[760px]">
      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <SectionTitle id="maintainers" title="Core Maintainers" />
        <SectionBlock className="min-h-[260px] md:min-h-[220px]" />
      </div>

      <div className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="space-y-8">
          <div className="h-10 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          <SectionBlock className="min-h-[320px] md:min-h-[260px]" />
        </div>
      </div>
    </div>
  )
}

export function HomeNewsletterFallback() {
  return (
    <div className="px-4 mx-auto max-w-(--breakpoint-lg) relative min-h-[330px] md:min-h-[360px]">
      <Card className="rounded-md p-8 min-h-[250px] animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-5 w-56 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-6 grid max-w-sm gap-2">
          <div className="h-12 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-56 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </Card>
      <div className="h-20" />
    </div>
  )
}
