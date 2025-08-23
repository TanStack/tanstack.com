import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'TanStack Ethos',
      description:
        'Our philosophy and commitment to building for the open web.',
    }),
  }),
})

export default function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-3xl mx-auto">
        <header className="">
          <h1 className="text-4xl font-bold">TanStack Ethos</h1>
        </header>

        <section className="">
          <p className="text-lg">
            At TanStack, our philosophy is simple: we build for the open web,
            open standards, and the freedom to compose, deploy, and innovate
            however you see fit.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Independently Owned, Unbiased by Design
          </h2>
          <p>
            TanStack LLC is currently <strong>100% privately owned</strong> by
            its founder with no external investors, no controlling interests,
            and no hidden agendas. It's currently funded by media and marketing
            partnerships with companies that share our core values:{' '}
            <strong>
              the open web, open standards, and the freedom to compose and
              deploy anything you want, anywhere you please.
            </strong>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">A Sustainable Future</h2>
          <p>
            TanStack is a lean, focused team: a full-time founder, several
            prominent and well-sponsored maintainers, contractors and
            contributors, and a thriving community of users who share our core
            values.
          </p>
          <p className="">
            Instead of chasing growth at all costs,{' '}
            <strong>
              we focus on sustainable growth that prioritizes developer
              experience, community needs, and long-term value creation.
            </strong>{' '}
            Our goal is to build lasting tools that genuinely improve how
            developers work, not to hit arbitrary metrics or satisfy external
            investor demands.
          </p>
          <p className="">That means:</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              No pressure to chase profits at the cost of developer experience.
            </li>
            <li>No corporate influence dictating our technical direction.</li>
            <li>
              A singular focus on{' '}
              <strong>
                building tools that make the web better for users and developers
              </strong>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Technology-Agnostic by Default
          </h2>
          <p>
            We believe in{' '}
            <strong>
              framework-agnostic, platform-agnostic, and future-proof tooling
            </strong>{' '}
            that puts developers first:
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              TanStack libraries are built on framework and platform-agnostic
              primitives. When our libraries build on other tools, like TanStack
              Start builds on Vite, we ensure that these tools uphold these same
              values of openness and flexibility.
            </li>
            <li>
              <strong>TanStack Libraries</strong> either already support or will
              support all major (and some minor!) frameworks and deployment
              environments—no exceptions.
            </li>
            <li>
              <strong>
                If there's any technology we're aligned with, it's TypeScript
              </strong>
              —or more broadly, "typed JavaScript", whatever that evolves into
              as time goes on.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Open Partners</h2>
          <p>
            Every partner we work with also actively upholds our values. They
            acknowledge that TanStack's OSS is a platform for developers, not a
            product to be leveraged:
          </p>
          <ul className="list-disc pl-8  space-y-2">
            <li>
              No partner can dictate or influence TanStack's core technology in
              a way that biases it toward their platform.
            </li>
            <li>
              Our libraries are built to serve <strong>developers first</strong>
              , and when appropriate, integrate with high quality external
              services that enhance the developer experience.
            </li>
            <li>
              Companies that support us do so first and foremost because they
              believe in what we're building and want to see it succeed for many
              years to come.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <p className="text-lg font-medium">
            At the end of the day,{' '}
            <strong>
              TanStack isn't just a set of libraries—it's a commitment to
              building the web <em>on your terms</em>, without compromise.
            </strong>{' '}
            All we need is enough to keep improving tools that we believe
            actually make the web a better place.
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <strong>- Tanner Linsley</strong>
            <br />
            Founder, TanStack LLC
          </div>
        </section>
      </div>
      <Footer />
    </div>
  )
}
