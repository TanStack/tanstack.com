import { Link } from '@tanstack/react-router'
import { Card } from '~/components/Card'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { MaintainerCard } from '~/components/MaintainerCard'
import { coreMaintainers } from '~/libraries/maintainers'
import { Button } from '~/ui'

const courses = [
  {
    name: 'The Official TanStack React Query Course',
    href: 'https://query.gg/?s=tanstack',
    description:
      "Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.",
  },
]

export function HomeCommunitySection() {
  return (
    <div className="space-y-24">
      <div className="lg:max-w-(--breakpoint-lg) px-4 mx-auto">
        <h3 id="courses" className="text-3xl font-bold mb-6 scroll-mt-24">
          <a
            href="#courses"
            className="hover:underline decoration-gray-400 dark:decoration-gray-600"
          >
            Courses
          </a>
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {courses.map((course) => (
            <Card
              as="a"
              key={course.name}
              href={course.href}
              className="flex gap-2 justify-between p-4 md:p-8 transition-all hover:shadow-md hover:border-green-500"
              target="_blank"
              rel="noreferrer"
            >
              <div className="col-span-2 md:col-span-5">
                <div className="text-2xl font-bold text-green-600">
                  {course.name}
                </div>
                <div className="text-sm mt-2">{course.description}</div>
                <div className="inline-block mt-4 px-4 py-2 bg-green-700 text-white rounded shadow font-black text-sm">
                  Check it out →
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="lg:max-w-(--breakpoint-lg) px-4 mx-auto">
        <div id="sponsors" className="scroll-mt-24">
          <LazySponsorSection
            title={
              <a
                href="#sponsors"
                className="hover:underline decoration-gray-400 dark:decoration-gray-600"
              >
                OSS Sponsors
              </a>
            }
          />
        </div>
        <div className="h-4" />
        <p className="italic mx-auto max-w-(--breakpoint-sm) text-gray-500 dark:text-gray-400 text-center">
          Sponsors get special perks like{' '}
          <strong>
            private discord channels, priority issue requests, direct support
            and even course vouchers
          </strong>
          !
        </p>
      </div>

      <div className="px-4 lg:max-w-(--breakpoint-lg) md:mx-auto">
        <h3 id="maintainers" className="text-3xl font-bold mb-6 scroll-mt-24">
          <a
            href="#maintainers"
            className="hover:underline decoration-gray-400 dark:decoration-gray-600"
          >
            Core Maintainers
          </a>
        </h3>
        <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
          {coreMaintainers.map((maintainer) => (
            <MaintainerCard key={maintainer.github} maintainer={maintainer} />
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Button as={Link} to="/maintainers">
            View All Maintainers
          </Button>
        </div>
      </div>
    </div>
  )
}
