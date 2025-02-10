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

        <section>
          <h2 className="text-2xl font-semibold">
            Independently Owned, Unbiased by Design
          </h2>
          <p>
            TanStack LLC is <strong>privately owned</strong>—no external
            investors, no controlling interests, and no hidden agendas. Our
            funding comes from media and marketing partnerships with companies
            that share our core values:{' '}
            <strong>
              openness, interoperability, and empowering developers to build
              without limitations.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">Sustainability Over Scale</h2>
          <p>
            Unlike some popular open-source projects burdened by massive
            payrolls, overhead, or investor expectations,{' '}
            <strong>
              TanStack doesn't need to make crazy amounts of money.
            </strong>{' '}
            It only needs to be sustainable for the people who put in the time
            to build and maintain it.
          </p>
          <p className="mt-4">That means:</p>
          <ul className="list-none space-y-2 mt-2">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>
              No pressure to chase profits at the cost of developer experience.
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>
              No corporate influence dictating our technical direction.
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>A long-term focus
              on <strong>what's best for developers, not shareholders.</strong>
            </li>
          </ul>
        </section>

        <section>
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
          <ul className="list-disc pl-8 mt-4 space-y-2">
            <li>
              <strong>TanStack Start</strong> is built on foundational
              primitives (like Nitro) that prioritize flexibility over lock-in.
            </li>
            <li>
              <strong>TanStack Libraries</strong> work seamlessly across all
              major frameworks and deployment environments—and when a new one
              rises, we aim to support it too.
            </li>
            <li>
              <strong>If we have any bias, it's toward TypeScript</strong>—or
              more broadly, whatever "typed JavaScript" evolves into over the
              next decade.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">
            Sponsorships Without Strings
          </h2>
          <p>Every sponsor we work with understands and respects our stance:</p>
          <ul className="list-disc pl-8 mt-4 space-y-2">
            <li>
              No sponsor can dictate or influence TanStack's technology in a way
              that biases it toward their platform.
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

        <section>
          <p className="text-lg font-medium">
            At the end of the day,{' '}
            <strong>
              TanStack isn't just a set of libraries—it's a commitment to
              building the web <em>on your terms</em>, without compromise.
            </strong>
          </p>
        </section>
      </div>
      <Footer />
    </div>
  )
}
