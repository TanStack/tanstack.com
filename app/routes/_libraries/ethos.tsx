import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_libraries/ethos')({
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
            TanStack LLC is <strong>100% privately owned</strong> by its
            founder—no external investors, no controlling interests, and no
            hidden agendas. Our funding comes from media and marketing
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
            prominent and well-sponsored maintainers and a thriving community of
            users and contributors who share our core values.
          </p>
          <p className="">
            Unlike venture-backed projects chasing growth at all costs,{' '}
            <strong>
              we don't need to "scale", "grow", or "expand" into a VC-funded,
              acquisition-seeking, or freemium-grifting product.
            </strong>{' '}
            We're not obsessed with hitting the next 10x multiplier to satisfy
            some parent company's lead-generating IPO ambitions.
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
              Start builds on Nitro, we ensure that these tools uphold these
              same values of openness and flexibility.
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
          <h2 className="text-2xl font-semibold">Open Sponsorships</h2>
          <p>
            Every sponsor we work with not only understands but actively upholds
            our values:
          </p>
          <ul className="list-disc pl-8  space-y-2">
            <li>
              No sponsor can dictate or influence TanStack's core technology in
              a way that biases it toward their platform.
            </li>
            <li>
              Our libraries are built to serve <strong>developers first</strong>
              , not corporate interests.
            </li>
            <li>
              If a company supports us, it's because they believe in what we're
              building—not because they expect preferential treatment.
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
