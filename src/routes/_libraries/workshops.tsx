import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { seo } from '~/utils/seo'
import { HiOutlineMail } from 'react-icons/hi'
import {
  LuUsers,
  LuVideo,
  LuMapPin,
  LuStar,
  LuCode,
  LuRocket,
  LuCheckCircle2,
  LuSettings,
  LuCode2,
} from 'react-icons/lu'
import * as React from 'react'
import { Footer } from '~/components/Footer'
import { allMaintainers, Maintainer } from '~/libraries/maintainers'
import { MaintainerCard } from '~/components/MaintainerCard'
import { shuffleWithSeed } from '~/utils/utils'

// Server function to get the seed based on 10-second intervals
// This ensures consistency between server and client
const getWorkshopSeed = createServerFn({ method: 'GET' }).handler(async () => {
  const now = Date.now()
  const tenSecondInterval = Math.floor(now / 10000) // Round down to 10-second intervals
  return tenSecondInterval.toString()
})

export const Route = createFileRoute('/_libraries/workshops')({
  component: WorkshopsPage,
  staleTime: 0, // Always re-run loader to get fresh instructors
  loader: async () => {
    const seed = await getWorkshopSeed({ data: undefined })
    return { seed }
  },
  head: () => ({
    meta: seo({
      title: 'Professional Workshops | TanStack',
      description: `Professional workshops on TanStack libraries from the creators and maintainers. Remote and in-person options available.`,
      keywords: `tanstack,workshops,training,education,react query,react table,tanstack router,professional training,corporate training,remote workshops`,
    }),
  }),
})

function WorkshopsPage() {
  const { seed } = Route.useLoaderData()
  // Calculate instructors on client side using the seed
  const availableInstructors = allMaintainers.filter(
    (m) => m.workshopsAvailable,
  )
  const shuffled = shuffleWithSeed(availableInstructors, seed, (m) => m.name)
  const instructors = shuffled.slice(0, 4) as Maintainer[]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-4 md:p-8 pb-0">
        <div className="flex flex-col gap-24 w-full max-w-5xl mx-auto">
          {/* Hero Section */}
          <header className="text-center pt-24">
            <h1 className="text-center text-3xl leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mb-8">
              Professional TanStack Workshops
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-6">
              Learn directly from the creators and maintainers of TanStack
              libraries. Get expert training on React Query, TanStack Table,
              TanStack Router, and the entire TanStack ecosystem.
            </p>
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Remote workshops available worldwide. In-person options with
              premium travel arrangements.
            </p>
            <a
              href="mailto:workshops@tanstack.com?subject=Workshop%20Inquiry"
              className="inline-flex items-center gap-3 px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-black text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-xl hover:scale-105"
            >
              <HiOutlineMail className="w-6 h-6" />
              Get a Quote
            </a>
          </header>

          {/* Value Proposition - Remote vs In-Person */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <LuVideo className="w-8 h-8 text-blue-500" />
                <h2 className="text-2xl font-black">Remote Workshops</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Convenient, cost-effective training delivered directly to your
                team from anywhere in the world. Perfect for distributed teams
                and flexible scheduling.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <LuCheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>No travel costs or logistics</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Flexible scheduling across time zones</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Interactive sessions with Q&A</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Access to maintainers and creators</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-6 shadow-lg text-white">
              <div className="flex items-center gap-3 mb-4">
                <LuMapPin className="w-8 h-8" />
                <h2 className="text-2xl font-black">In-Person Workshops</h2>
              </div>
              <p className="mb-4 opacity-90">
                Premium on-site training with the option to have TanStack
                creators travel to your location. Maximum impact with
                face-to-face interaction and personalized attention.
              </p>
              <ul className="space-y-2 text-sm opacity-90">
                <li className="flex items-start gap-2">
                  <LuStar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>Premium experience with direct access</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuStar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>Personal appearance by Tanner Linsley available</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuStar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>Customized workshop content</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuStar className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>Extended Q&A and networking sessions</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Why Choose TanStack Workshops */}
          <div
            className="relative bg-gray-50 dark:bg-gray-900 py-32 w-screen -mx-[calc(50vw-50%)] md:w-[calc(100vw-250px)] md:mx-[calc(-50vw+50%+125px)]"
            style={{
              boxShadow: '0 0 80px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="max-w-5xl mx-auto px-4 md:px-8">
              <h2 className="text-2xl font-black mb-6 text-center">
                Why Learn from TanStack?
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <LuCode className="w-12 h-12 text-blue-500 dark:text-blue-400 mx-auto mb-3" />
                  <h3 className="font-black mb-2">From the Source</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Learn directly from the maintainers and creators who built
                    these libraries. Get insights you can't find anywhere else.
                  </p>
                </div>
                <div className="text-center">
                  <LuUsers className="w-12 h-12 text-blue-600 dark:text-blue-500 mx-auto mb-3" />
                  <h3 className="font-black mb-2">Expert Instructors</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Our workshops are led by experienced maintainers who
                    understand real-world challenges and best practices.
                  </p>
                </div>
                <div className="text-center">
                  <LuRocket className="w-12 h-12 text-blue-700 dark:text-blue-600 mx-auto mb-3" />
                  <h3 className="font-black mb-2">Practical Focus</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Hands-on training that helps your team ship better code
                    faster. Real examples, real solutions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Body Copy: What Makes Our Workshops Different */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-4">
                Training That Moves the Needle
              </h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Our workshops aren't just presentations—they're interactive
                learning experiences designed to transform how your team works
                with TanStack libraries. We focus on real-world scenarios,
                common pitfalls, and best practices that you can apply
                immediately to your projects.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <LuSettings className="w-8 h-8 text-blue-500 dark:text-blue-400 mb-3" />
                <h3 className="text-lg font-black mb-2">
                  Customized to Your Stack
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Every workshop is tailored to your team's specific tech stack,
                  challenges, and goals. We work with you beforehand to
                  understand your codebase and create relevant examples that
                  resonate with your developers.
                </p>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <LuCode2 className="w-8 h-8 text-blue-600 dark:text-blue-500 mb-3" />
                <h3 className="text-lg font-black mb-2">Hands-On Learning</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Expect to code, not just listen. Our workshops include live
                  coding sessions, exercises, and Q&A periods where you can get
                  immediate answers to your specific questions from the people
                  who built the tools you're learning.
                </p>
              </div>
            </div>
          </div>

          {/* CTA 1: Action-Oriented */}
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">
              Ready to Level Up Your Team?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-xl mx-auto">
              Get a custom quote for your team's workshop needs. We'll work with
              you to create the perfect training experience.
            </p>
            <a
              href="mailto:workshops@tanstack.com?subject=Workshop%20Inquiry"
              className="inline-flex items-center gap-3 px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg font-black text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 hover:shadow-xl hover:scale-105"
            >
              <HiOutlineMail className="w-6 h-6" />
              Get a Quote
            </a>
          </div>

          {/* Instructors Section */}
          <div
            className="relative bg-gray-50 dark:bg-gray-900 py-20 w-screen -mx-[calc(50vw-50%)] md:w-[calc(100vw-250px)] md:mx-[calc(-50vw+50%+125px)]"
            style={{
              boxShadow: '0 0 80px rgba(0, 0, 0, 0.04)',
            }}
          >
            <InstructorsSection instructors={instructors} />
          </div>

          {/* Body Copy: Workshop Format Details */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black mb-4">
                Flexible Formats for Every Team
              </h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Whether you're a small startup or a large enterprise, we offer
                workshop formats that fit your schedule and budget. From
                half-day deep dives to multi-day comprehensive training
                programs, we'll design something that works for you.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-2">
                  2-4 hours
                </div>
                <h3 className="text-lg font-semibold mb-2">Quick Deep Dives</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Focused sessions on specific topics or libraries. Perfect for
                  teams who need targeted knowledge quickly.
                </p>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
                  1-2 days
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Comprehensive Training
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Full-day workshops covering multiple libraries and advanced
                  patterns. Ideal for teams adopting TanStack across their
                  stack.
                </p>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center">
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-2">
                  Custom
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Tailored Programs
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Multi-day programs designed around your specific needs.
                  Includes follow-up sessions and ongoing support.
                </p>
              </div>
            </div>
          </div>

          {/* CTA 2: Information-Seeking */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-8 border border-blue-200 dark:border-blue-800">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">
                Have Questions About Our Workshops?
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-xl mx-auto">
                We're here to help you understand how our workshops can benefit
                your team. Reach out to discuss topics, formats, scheduling, and
                pricing.
              </p>
              <a
                href="mailto:workshops@tanstack.com?subject=Workshop%20Questions"
                className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 hover:shadow-lg"
              >
                <HiOutlineMail className="w-5 h-5" />
                Ask Us Anything
              </a>
            </div>
          </div>

          {/* Topics Covered */}
          <div
            className="relative bg-gray-50 dark:bg-gray-900 py-20 w-screen -mx-[calc(50vw-50%)] md:w-[calc(100vw-250px)] md:mx-[calc(-50vw+50%+125px)]"
            style={{
              boxShadow: '0 0 80px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="max-w-5xl mx-auto px-4 md:px-8">
              <h2 className="text-2xl font-black mb-6 text-center">
                Workshop Topics Available
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  'React Query / TanStack Query',
                  'TanStack Table',
                  'TanStack Router',
                  'TanStack Form',
                  'TanStack Start',
                  'TanStack DB',
                  'TanStack Virtual',
                  'Advanced Patterns & Best Practices',
                ].map((topic) => (
                  <div
                    key={topic}
                    className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-800 px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <LuCheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {topic}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
                Custom workshops can be tailored to your specific needs and use
                cases.
              </p>
            </div>
          </div>

          {/* Premium Appearance Section - Deal Sweetener */}
          <div className="relative py-20 px-4 md:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-block p-1 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 mb-6 shadow-lg">
                <img
                  src="https://github.com/tannerlinsley.png"
                  alt="Tanner Linsley"
                  className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-900"
                />
              </div>
              <h2 className="text-2xl font-black mb-4">
                Want Tanner Linsley at your workshop?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                TanStack creator Tanner Linsley is available for premium
                appearances, Q&A sessions, lightning consults, or to give your
                session that extra kick to inspire your developers. Add this
                exclusive experience to any workshop package.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
                  <LuStar className="w-4 h-4" />
                  <span>Q&A Sessions</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
                  <LuCode className="w-4 h-4" />
                  <span>Lightning Consults</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
                  <LuRocket className="w-4 h-4" />
                  <span>Inspire Your Developers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials Section */}
          <div
            className="relative bg-gray-50 dark:bg-gray-900 py-20 w-screen -mx-[calc(50vw-50%)] md:w-[calc(100vw-250px)] md:mx-[calc(-50vw+50%+125px)]"
            style={{
              boxShadow: '0 0 80px rgba(0, 0, 0, 0.04)',
            }}
          >
            <TestimonialsMarquee />
          </div>

          {/* Final CTA */}
          <div className="text-center py-8 pb-32">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              All workshops are customized to your team's needs. Pricing varies
              based on format, duration, and instructor availability.
            </p>
            <a
              href="mailto:workshops@tanstack.com?subject=Workshop%20Inquiry"
              className="inline-flex items-center gap-3 px-8 py-4 bg-linear-to-r from-green-600 to-cyan-600 text-white rounded-lg font-black text-lg hover:from-green-700 hover:to-cyan-700 transition-all duration-200 hover:shadow-xl hover:scale-105"
            >
              <HiOutlineMail className="w-6 h-6" />
              Get Started Today
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function TestimonialsMarquee() {
  const testimonials = [
    {
      quote:
        'The support team helped us debug a complex React Query issue in minutes that would have taken us days.',
      author: 'Engineering Lead',
      company: 'Fortune 500 Company',
    },
    {
      quote:
        'Getting direct access to the maintainers saved us from making architectural mistakes. Worth every penny.',
      author: 'Senior Developer',
      company: 'Tech Startup',
    },
    {
      quote:
        "Their expertise on TanStack Router helped us migrate our entire app structure. Best consulting investment we've made.",
      author: 'CTO',
      company: 'SaaS Company',
    },
    {
      quote:
        'The remote support sessions were perfect for our distributed team. Quick responses and deep technical knowledge.',
      author: 'Engineering Manager',
      company: 'Remote-First Company',
    },
    {
      quote:
        "Working directly with the creators gave us insights we couldn't find in documentation or Stack Overflow.",
      author: 'Lead Developer',
      company: 'E-commerce Platform',
    },
    {
      quote:
        'They helped us optimize our TanStack Table implementation. Performance improvements were immediate and significant.',
      author: 'Frontend Lead',
      company: 'Fintech Startup',
    },
    {
      quote:
        'The support team understood our codebase quickly and provided solutions that fit our specific architecture.',
      author: 'Product Engineer',
      company: 'Analytics Platform',
    },
    {
      quote:
        'Their guidance on TanStack Form validation patterns saved us weeks of development time.',
      author: 'Tech Lead',
      company: 'Enterprise SaaS',
    },
  ]

  const animationDuration = `${(testimonials.length * 400) / 80}s`

  return (
    <div className="overflow-hidden w-full py-8 relative">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black mb-2">What Teams Are Saying</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Feedback from teams who've experienced our support
        </p>
      </div>
      <div className="relative w-full">
        {/* Left fade overlay */}
        <div className="absolute left-0 top-0 bottom-0 w-48 z-10 bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent pointer-events-none" />
        {/* Right fade overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-48 z-10 bg-gradient-to-l from-gray-50 dark:from-gray-900 via-gray-50/80 dark:via-gray-900/80 to-transparent pointer-events-none" />
        <div
          className="flex gap-8 items-stretch will-change-transform animate-[testimonials_linear_infinite]"
          style={{
            animationDuration,
          }}
        >
          {[...testimonials, ...testimonials, ...testimonials].map(
            (testimonial, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-80 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start gap-2 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <LuStar
                      key={j}
                      className="w-4 h-4 text-yellow-500 fill-yellow-500"
                    />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm italic">
                  "{testimonial.quote}"
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <div className="font-semibold">{testimonial.author}</div>
                  <div>{testimonial.company}</div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes testimonials { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
          .animate-[testimonials_linear_infinite] { animation-name: testimonials; animation-timing-function: linear; animation-iteration-count: infinite; }
        `,
        }}
      />
    </div>
  )
}

function InstructorsSection({ instructors }: { instructors: Maintainer[] }) {
  return (
    <div className="px-4 md:px-8">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-black mb-2">Meet Your Instructors</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Learn from the core maintainers and creators who build the tools you
          use
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto text-left mb-8">
        {instructors.map((instructor) => (
          <MaintainerCard
            key={instructor.github}
            maintainer={instructor}
            hideLibraries
          />
        ))}
      </div>
      <div className="text-center">
        <a
          href="mailto:workshops@tanstack.com?subject=Workshop%20Inquiry&body=I'm interested in learning more about your workshop instructors and availability."
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 hover:shadow-lg"
        >
          <HiOutlineMail className="w-5 h-5" />
          Learn More About Our Instructors
        </a>
      </div>
    </div>
  )
}
