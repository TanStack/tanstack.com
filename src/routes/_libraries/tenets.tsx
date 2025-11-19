import { createFileRoute, Link } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_libraries/tenets')({
  component: RouteComp,
  head: () => ({
    meta: seo({
      title: 'TanStack Product Tenets',
      description:
        'The core tenets that guide all TanStack libraries and products.',
    }),
  }),
})

function RouteComp() {
  return (
    <div className="flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
      <div className="flex-1 space-y-12 w-full max-w-3xl mx-auto">
        <header className="">
          <h1 className="text-3xl font-black">TanStack Product Tenets</h1>
        </header>

        <section className="">
          <p className="text-lg">
            These tenets define the core principles that guide every TanStack
            library and product. They serve as both a quality bar for what
            developers can expect from our tools and as a reference for
            evaluating contributions, features, and ideas.
          </p>
          <p className="text-lg mt-4">
            These tenets complement our{' '}
            <Link to="/ethos" className="underline">
              organizational ethos
            </Link>
            , which covers our business values and independence. Together, they
            ensure that TanStack remains committed to building tools that make
            the web better for developers—on your terms, without compromise.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            1. Open, Independent, Technology-Agnostic
          </h2>
          <p>
            Every TanStack library starts with a provider-agnostic core,
            ensuring that developers are never locked into a specific vendor,
            platform, or ecosystem. Integrations are layered on top as optional
            adapters—never as the foundation.
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>Neutral core, optional integrations:</strong> Every
              TanStack library starts with a provider-agnostic core (framework,
              runtime, vendor, or service), with integrations layered on top as
              optional adapters—never as the foundation.
            </li>
            <li>
              <strong>Portability over deep lock-in:</strong> We design APIs so
              that swapping providers, platforms, or runtimes is feasible
              without rewriting business logic; any provider-specific behavior
              is clearly cordoned off.
            </li>
            <li>
              <strong>Uniform abstractions across providers:</strong> Where
              multiple vendors/services solve similar problems, we provide a
              consistent abstraction that makes them interchangeable from the
              developer's perspective.
            </li>
            <li>
              <strong>We don't chase every niche feature:</strong> We
              intentionally avoid modeling every bespoke feature of every
              vendor; we focus on the shared, high-leverage capabilities that
              most teams actually need.
            </li>
            <li>
              <strong>Graceful degradation, not fragmentation:</strong> When a
              provider offers extra capabilities, they plug into extension
              points or optional layers rather than fragmenting the core
              abstraction or dictating its shape.
            </li>
          </ul>
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="font-semibold mb-2">What this rules out:</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Vendor-biased APIs or partner-driven features in core</li>
              <li>
                Contributions that introduce platform bias or "we're all-in on X
                vendor" assumptions
              </li>
              <li>
                Features that require committing to a specific cloud provider or
                deployment model
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            2. Composable, Platform-Aligned Primitives
          </h2>
          <p>
            We build focused, composable primitives that embrace the platform
            rather than hiding it. Every library should be adoptable
            incrementally, without requiring rewrites or creating hard
            dependencies on other TanStack tools.
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>Primitives before frameworks:</strong> We ship focused,
              composable building blocks rather than all-inclusive "one
              framework to rule them all" abstractions.
            </li>
            <li>
              <strong>Embrace the platform:</strong> We leverage the web, HTTP,
              JS/TS, and servers instead of hiding them behind opaque layers of
              magic.
            </li>
            <li>
              <strong>Progressive adoption:</strong> Every library should be
              adoptable one piece at a time, without rewrites or hard coupling
              to the rest of TanStack.
            </li>
            <li>
              <strong>Escape hatches by design:</strong> It must always be
              possible to drop down a level, integrate with existing systems, or
              bypass our abstractions when necessary.
            </li>
          </ul>
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="font-semibold mb-2">What this rules out:</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>
                Designs that require full rewrites or "all-in" commitments
              </li>
              <li>
                Heavy global singletons or hard dependencies between TanStack
                libraries
              </li>
              <li>
                Abstractions that hide platform capabilities without clear
                escape routes
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            3. Pragmatic, Production-Grade Quality
          </h2>
          <p>
            We design around real-world production use-cases, edge cases, and
            long-lived applications—not just happy-path demos. Performance and
            scalability are requirements, not nice-to-haves.
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>Real products as the bar:</strong> We design around
              real-world workloads, edge cases, and long-lived apps—not just
              happy-path demos.
            </li>
            <li>
              <strong>"Ship today" quality:</strong> Features are not done until
              we'd be comfortable running them in our own revenue-critical
              applications.
            </li>
            <li>
              <strong>Performance and scale as requirements:</strong> Rendering,
              caching, and network behavior must hold up under scale;
              performance is not a nice-to-have.
            </li>
            <li>
              <strong>DX that earns its cost:</strong> API ergonomics, tooling,
              and docs should measurably improve developer outcomes, not add
              clever ceremony.
            </li>
          </ul>
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="font-semibold mb-2">What this rules out:</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>
                Demo-only features that don't hold up under real-world load
              </li>
              <li>
                Magic that's impossible to debug or reason about when something
                goes wrong
              </li>
              <li>
                Changes that optimize for benchmarks over real-world reliability
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            4. Predictable, Explicit, Type-Safe Behavior
          </h2>
          <p>
            We minimize magic and maximize clarity. State, side effects, and
            data flow should be understandable from code, not guessed from
            hidden behavior. Type safety should guide correct usage without
            drowning users in generics.
          </p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>Minimal magic, maximum clarity:</strong> State, side
              effects, and data flow must be understandable from code, not
              guessed from hidden behavior.
            </li>
            <li>
              <strong>Explicit over implicit:</strong> Important behaviors are
              explicit in APIs and configuration, with surprising defaults
              treated as a bug.
            </li>
            <li>
              <strong>Type safety as leverage, not dogma:</strong> TypeScript
              support should guide correct use and catch real bugs without
              drowning users in generics.
            </li>
            <li>
              <strong>Stable APIs and migrations:</strong> We evolve carefully,
              with clear changelogs and migration paths; breakage for style or
              hype is unacceptable.
            </li>
          </ul>
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="font-semibold mb-2">What this rules out:</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>
                Hidden global state or surprising side effects that aren't
                obvious from the API
              </li>
              <li>
                Backwards-incompatible API churn without clear migration paths
              </li>
              <li>
                Type signatures that are technically correct but unusable in
                practice
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">How to Use These Tenets</h2>
          <p>These tenets serve multiple purposes for different audiences:</p>
          <ul className="list-disc pl-8 space-y-2">
            <li>
              <strong>For developers evaluating TanStack:</strong> These tenets
              define what you can expect from our libraries—quality,
              portability, and a commitment to your freedom to compose and
              deploy however you see fit.
            </li>
            <li>
              <strong>For contributors:</strong> When proposing features or
              changes, consider how they align with these tenets. If your idea
              conflicts with a tenet, explicitly address why and how the
              conflict is justified.
            </li>
            <li>
              <strong>For maintainers and reviewers:</strong> Use these tenets
              as a checklist when evaluating PRs, feature requests, and
              architectural decisions. If something threatens a tenet, it needs
              strong justification or should be rejected.
            </li>
            <li>
              <strong>For partners:</strong> These tenets ensure that our
              libraries remain neutral and developer-focused. Partner
              integrations must respect these principles and cannot bias core
              APIs toward specific platforms or vendors.
            </li>
          </ul>
          <p className="mt-4">
            These tenets work alongside our{' '}
            <Link to="/ethos" className="underline">
              organizational ethos
            </Link>
            , which covers our business independence, sustainability, and
            commitment to the open web. Together, they ensure TanStack remains
            true to its mission: building tools that make the web better for
            developers, on your terms.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  )
}
