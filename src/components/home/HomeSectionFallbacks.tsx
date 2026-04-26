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
    <div className="space-y-24 min-h-[1500px] md:min-h-[1010px] lg:min-h-[980px]">
      <div className="lg:max-w-(--breakpoint-lg) px-4 mx-auto">
        <SectionTitle id="courses" title="Courses" />
        <SectionBlock className="min-h-[220px]" />
      </div>

      <div className="px-4 w-full lg:max-w-(--breakpoint-lg) md:mx-auto">
        <div className="space-y-8">
          <div className="h-10 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          <SectionBlock className="min-h-[320px] md:min-h-[260px]" />
        </div>
      </div>

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <SectionTitle id="maintainers" title="Core Maintainers" />
        <SectionBlock className="min-h-[260px] md:min-h-[220px]" />
      </div>
    </div>
  )
}

export function HomeBytesFallback() {
  return (
    <div className="px-4 mx-auto max-w-(--breakpoint-lg) relative min-h-[330px] md:min-h-[360px]">
      <Card className="rounded-md p-8 min-h-[250px] animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-5 w-56 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="col-span-2 h-12 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-12 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </Card>
      <div className="h-20" />
    </div>
  )
}

export function HomeApplicationStarterFallback() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[320px] overflow-hidden rounded-[1rem] border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 md:min-h-[360px]"
    >
      <div className="border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="h-7 w-64 max-w-full rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="h-9 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      <div className="relative border-b border-gray-200 dark:border-gray-800">
        <div className="px-5 pt-4">
          <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="px-5 pb-4 pt-3">
          <div className="h-28 rounded-xl bg-gray-100 dark:bg-gray-900" />
        </div>

        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-3">
            <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function HomeStatsFallback() {
  return (
    <Card className="relative min-h-[360px] p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8 items-center justify-center xl:min-h-[164px] xl:place-items-center rounded-[1rem] animate-pulse">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-4 items-center">
          <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="flex-1 min-w-0">
            <div className="h-7 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-4 w-28 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </Card>
  )
}
