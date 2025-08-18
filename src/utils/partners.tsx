import agGridDarkSvg from '~/images/ag-grid-dark.svg'
import agGridLightSvg from '~/images/ag-grid-light.svg'
import nozzleImage from '~/images/nozzle.png'
import nozzleDarkSvg from '~/images/nozzle-dark.svg'
import nozzleLightSvg from '~/images/nozzle-light.svg'
import bytesUidotdevImage from '~/images/bytes-uidotdev.png'
import vercelLightSvg from '~/images/vercel-light.svg'
import vercelDarkSvg from '~/images/vercel-dark.svg'
import netlifyLightSvg from '~/images/netlify-light.svg'
import netlifyDarkSvg from '~/images/netlify-dark.svg'
import convexWhiteSvg from '~/images/convex-white.svg'
import convexColorSvg from '~/images/convex-color.svg'
import clerkLightSvg from '~/images/clerk-logo-light.svg'
import clerkDarkSvg from '~/images/clerk-logo-dark.svg'
import sentryWordMarkLightSvg from '~/images/sentry-wordmark-light.svg'
import sentryWordMarkDarkSvg from '~/images/sentry-wordmark-dark.svg'
import speakeasyLightSvg from '~/images/speakeasy-light.svg'
import speakeasyDarkSvg from '~/images/speakeasy-dark.svg'
import neonLightSvg from '~/images/neon-light.svg'
import neonDarkSvg from '~/images/neon-dark.svg'
import unkeyBlackSvg from '~/images/unkey-black.svg'
import unkeyWhiteSvg from '~/images/unkey-white.svg'
import electricDarkSvg from '~/images/electric-dark.svg'
import electricLightSvg from '~/images/electric-light.svg'
import prismaLightSvg from '~/images/prisma-light.svg'
import prismaDarkSvg from '~/images/prisma-dark.svg'
import codeRabbitLightSvg from '~/images/coderabbit-light.svg'
import codeRabbitDarkSvg from '~/images/coderabbit-dark.svg'
import { libraries, Library } from '~/libraries'

function LearnMoreButton() {
  return (
    <span className="text-blue-500 uppercase font-black text-sm">
      Learn More
    </span>
  )
}

type Partner = {
  name: string
  id: string
  libraries?: Library['id'][]
  sidebarImgLight?: string
  sidebarImgDark?: string
  href: string
  homepageImg: JSX.Element
  content: JSX.Element
  sidebarImgClass?: string
  status?: 'active' | 'inactive'
  startDate?: string
  endDate?: string
}

const neon = (() => {
  const href = 'https://neon.tech?utm_source=tanstack'

  return {
    name: 'Neon',
    id: 'neon',
    libraries: ['start', 'router'],
    sidebarImgLight: neonLightSvg,
    sidebarImgDark: neonDarkSvg,
    sidebarImgClass: 'py-3 scale-[1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-6">
        <img
          src={neonLightSvg}
          alt="Neon"
          className="w-[260px] max-w-full dark:hidden"
          width="260"
          height="72"
        />
        <img
          src={neonDarkSvg}
          alt="Neon"
          className="w-[260px] max-w-full hidden dark:block"
          width="260"
          height="72"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Neon and TanStack are joining forces to bring{' '}
          <strong>serverless PostgreSQL</strong> to the modern web stack. With
          Neon's{' '}
          <strong>
            blazing-fast branching, autoscaling, and storage/compute separation
          </strong>
          , developers can instantly spin up production-grade databases for
          every branch, test, or feature. TanStack's developer-first framework +
          Neon's cutting-edge infra = next-gen DX.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const convex = (() => {
  const href = 'https://convex.dev?utm_source=tanstack'

  return {
    name: 'Convex',
    id: 'convex',
    libraries: ['start', 'router'],
    sidebarImgLight: convexColorSvg,
    sidebarImgDark: convexWhiteSvg,
    sidebarImgClass: 'py-5 scale-[1.1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-6">
        <img
          src={convexColorSvg}
          alt="Convex"
          className="w-[300px] max-w-full dark:hidden"
        />
        <img
          src={convexWhiteSvg}
          alt="Convex"
          className="w-[300px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Convex has teamed up with TanStack to not only deliver a{' '}
          <strong>first-class end-to-end type-safe database experience</strong>{' '}
          to TanStack developers, but to also ensure TanStack is ready for the
          real-time database arena. Convex's all-in-one platform delivers
          end-to-end type-safety via a{' '}
          <strong>revolutionary relational, real-time database</strong> and
          together, we're elevating what's possible with real-time React
          applications.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const clerk = (() => {
  const href = 'https://go.clerk.com/wOwHtuJ'

  return {
    name: 'Clerk',
    id: 'clerk',
    href,
    libraries: ['start', 'router'],
    sidebarImgLight: clerkLightSvg,
    sidebarImgDark: clerkDarkSvg,
    sidebarImgClass: 'py-4',
    status: 'active' as const,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-12">
        <img
          src={clerkLightSvg}
          alt="Clerk"
          className="w-[200px] max-w-full dark:hidden"
        />
        <img
          src={clerkDarkSvg}
          alt="Clerk"
          className="w-[200px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Clerk and TanStack are partnering to elevate your application's{' '}
          <strong>security and user experience</strong> with industry-leading{' '}
          <strong>authentication and user management</strong>. Paired with
          TanStack's no-nonsense routing and tooling, you'll be equipped to
          effortlessly deliver top-notch experiences that your users can trust
          and your developers can rely on.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const agGrid = (() => {
  const href =
    'https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable'

  return {
    name: 'AG Grid',
    id: 'ag-grid',
    libraries: ['table'] as const,
    sidebarImgLight: agGridDarkSvg,
    sidebarImgDark: agGridLightSvg,
    sidebarImgClass: 'py-5 scale-[1.1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="px-8 py-8">
        <img
          src={agGridDarkSvg}
          alt="Enterprise Data Grid"
          className="w-[290px] max-w-full dark:hidden"
          width="290"
          height="95"
        />
        <img
          src={agGridLightSvg}
          alt="Enterprise Data Grid"
          className="w-[290px] max-w-full hidden dark:block"
          width="290"
          height="95"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          TanStack Table and AG Grid are respectfully the{' '}
          <strong>best table/datagrid libraries around</strong> and together are
          working hard to ensure the highest quality table/datagrid experience
          for the entire JS/TS ecosystem. Whether it's a lightweight table or a
          complex datagrid, we've we've got you covered.
        </div>
        {/* Has to be button for separate link than parent anchor to be valid HTML */}
        <button
          type="button"
          onClick={() => {
            window.location.href = '/blog/ag-grid-partnership'
          }}
          className="text-blue-500 uppercase font-black text-sm"
        >
          Learn More
        </button>
      </>
    ),
  }
})()

const netlify = (() => {
  const href = 'https://netlify.com?utm_source=tanstack'

  return {
    name: 'Netlify',
    id: 'netlify',
    libraries: ['start', 'router'],
    sidebarImgLight: netlifyLightSvg,
    sidebarImgDark: netlifyDarkSvg,
    sidebarImgClass: 'pt-2 scale-[.9]',
    sidebarAfterImg: (
      <div className="text-[10px] rounded-xl m-1 mx-auto w-fit text-center py-px px-2 bg-[#03bdba] text-white uppercase font-bold">
        Official Deployment Partner
      </div>
    ),
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="flex flex-col justify-center items-center pb-4 gap-2 relative w-full h-full space-y-2">
        <div className="w-full h-full flex items-center justify-center px-4 pt-6 pb-2">
          <img
            src={netlifyLightSvg}
            alt="Convex"
            className="w-[280px] max-w-full dark:hidden"
          />
          <img
            src={netlifyDarkSvg}
            alt="Convex"
            className="w-[280px] max-w-full hidden dark:block"
          />
        </div>
        <div
          className="w-auto text-xs text-center
        py-1 px-3 rounded-xl uppercase font-bold bg-linear-to-r from-[#03bdba] to-[#00aaba] text-white "
        >
          Official Deployment Partner
        </div>
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Netlify and TanStack have joined forces to provide developers with{' '}
          <strong>world-class deployment and hosting capabilities</strong> for
          modern web applications. Together we're focused on delivering an
          exceptional developer experience through{' '}
          <strong>
            seamless deployment workflows, edge functions, and serverless
            capabilities
          </strong>{' '}
          that help teams build and ship faster. Our partnership ensures
          TanStack applications can take full advantage of Netlify's powerful
          platform features.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const sentry = (() => {
  const href = 'https://sentry.io?utm_source=tanstack'

  return {
    name: 'Sentry',
    id: 'sentry',
    libraries: ['start', 'router'],
    sidebarImgLight: sentryWordMarkDarkSvg,
    sidebarImgDark: sentryWordMarkLightSvg,
    sidebarImgClass: 'py-4 scale-[1.1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-6">
        <img
          src={sentryWordMarkDarkSvg}
          alt="Sentry"
          className="w-[275px] max-w-full dark:hidden"
        />
        <img
          src={sentryWordMarkLightSvg}
          alt="Sentry"
          className="w-[275px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Sentry and TanStack are on a mission to make sure your apps are
          <strong> error-free and high-performers</strong>. Sentry's
          best-in-class error monitoring and performance insights combined with
          TanStack's cutting-edge libraries ensure that you can deliver the best
          possible experience to your users. Together, we're committed to making
          sure that you can build with confidence.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const uiDev = (() => {
  const href = 'https://bytes.dev?utm_source-tanstack&utm_campaign=tanstack'

  return {
    name: 'UI.dev',
    id: 'ui-dev',
    libraries: [],
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="py-4">
        <img
          src={bytesUidotdevImage}
          alt="Bytes Logo"
          className="w-[350px] max-w-full"
          width="250"
          height="87"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          TanStack's priority is to make its users productive, efficient and
          knowledgeable about web dev. To help us on this quest, we've partnered
          with{' '}
          {/* Has to be button for separate link than parent anchor to be valid HTML */}
          <button
            type="button"
            className="text-blue-500 underline cursor-pointer p-0 m-0 bg-transparent border-none inline"
            onClick={() =>
              window.open(
                'https://ui.dev/?utm_source=tanstack&utm_campaign=tanstack',
                '_blank',
                'noopener,noreferrer'
              )
            }
            tabIndex={0}
          >
            ui.dev
          </button>{' '}
          to <strong>provide best-in-class education</strong> about TanStack
          products. It doesn't stop at TanStack though, with their sister
          product{' '}
          <button
            type="button"
            className="text-blue-500 underline cursor-pointer p-0 m-0 bg-transparent border-none inline"
            onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
            tabIndex={0}
          >
            Bytes.dev
          </button>{' '}
          as our official newsletter partner, you'll be able to{' '}
          <strong>stay up to date with the latest and greatest</strong> in the
          web dev world regardless.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const nozzle = (() => {
  const href = 'https://nozzle.io/?utm_source=tanstack&utm_campaign=tanstack'

  return {
    name: 'Nozzle.io',
    id: 'nozzle',
    href,
    sidebarImgLight: nozzleDarkSvg,
    sidebarImgDark: nozzleLightSvg,
    sidebarImgClass: 'w-[150px] py-4',
    status: 'active' as const,
    homepageImg: (
      <div className="py-6">
        <img
          src={nozzleImage}
          alt="SEO keyword rank tracker"
          className="w-[230px] max-w-full my-2"
          width="230"
          height="80"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Since its founding, Nozzle's SEO platform was the original home for
          almost all TanStack libraries. They were used to build the{' '}
          <strong>
            most technically advanced search engine monitoring platform
          </strong>{' '}
          of its kind. Its enterprise rank tracking and keyword research tools
          continue to set a new bar for quality and scale. Nozzle continues to
          prove the value of the full gamut of TanStack tools on the front-end
          with unmatched UI/UX.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const speakeasy = (() => {
  const href =
    'https://www.speakeasy.com/product/react-query?utm_source=tanstack&utm_campaign=tanstack'

  return {
    name: 'Speakeasy',
    id: 'speakeasy',
    href,
    sidebarImgLight: speakeasyLightSvg,
    sidebarImgDark: speakeasyDarkSvg,
    sidebarImgClass: 'w-[150px] py-4',
    libraries: ['query'] as const,
    status: 'inactive' as const,
    startDate: 'Feb 2025',
    endDate: 'Jul 2025',
    homepageImg: (
      <div className="py-6">
        <img
          src={speakeasyLightSvg}
          alt="Speakeasy"
          className="w-[300px] max-w-full my-2 dark:hidden"
          width="300"
          height="100"
        />
        <img
          src={speakeasyDarkSvg}
          alt="Speakeasy"
          className="w-[300px] max-w-full my-2 hidden dark:block"
          width="300"
          height="100"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Speakeasy and TanStack are working together to make{' '}
          <strong>API management effortless</strong>. With Speakeasy's{' '}
          <strong>automated SDK generation</strong> and TanStack's robust
          front-end tooling, developers can move faster than ever. Whether
          you're integrating APIs or streamlining your developer experience,
          this partnership ensures you're covered from server to client with{' '}
          <strong>powerful, type-safe, and optimized solutions</strong>.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const unkey = (() => {
  const href = 'https://www.unkey.com/?utm_source=tanstack'

  return {
    name: 'Unkey',
    id: 'unkey',
    libraries: ['pacer'] as const,
    sidebarImgLight: unkeyBlackSvg,
    sidebarImgDark: unkeyWhiteSvg,
    sidebarImgClass: 'py-4 scale-[1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-6">
        <img
          src={unkeyBlackSvg}
          alt="Unkey"
          className="w-[180px] max-w-full dark:hidden"
          width="180"
          height="77"
        />
        <img
          src={unkeyWhiteSvg}
          alt="Unkey"
          className="w-[180px] max-w-full hidden dark:block"
          width="180"
          height="77"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Unkey and TanStack are teaming up to streamline API management for
          developers. With Unkey's powerful features like{' '}
          <strong>API key management</strong>, <strong>rate limiting</strong>,
          and <strong>usage analytics</strong>, integrating with TanStack's
          developer-first tools becomes seamless. Together, we're enhancing the
          developer experience by providing secure and scalable solutions for
          modern web applications.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const electric = (() => {
  const href = 'https://electric-sql.com'

  return {
    name: 'Electric',
    id: 'electric',
    libraries: ['db'] as const,
    sidebarImgLight: electricLightSvg,
    sidebarImgDark: electricDarkSvg,
    sidebarImgClass: 'py-4 scale-[1.1]',
    status: 'active' as const,
    href,
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-6">
        <img
          src={electricLightSvg}
          alt="Electric"
          className="w-[240px] max-w-full dark:hidden"
        />
        <img
          src={electricDarkSvg}
          alt="Electric"
          className="w-[240px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          Electric and TanStack are teaming up on TanStack DB to bring sync to
          mainstream application developers.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const vercel = (() => {
  const href = 'https://vercel.com?utm_source=tanstack'

  return {
    name: 'Vercel',
    id: 'vercel',
    href,
    libraries: ['start', 'router'] as const,
    sidebarImgLight: vercelLightSvg,
    sidebarImgDark: vercelDarkSvg,
    sidebarImgClass: 'py-4',
    status: 'inactive' as const,
    startDate: 'May 2024',
    endDate: 'Oct 2024',
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-12">
        <img
          src={vercelLightSvg}
          alt="Vercel"
          className="w-[220px] max-w-full dark:hidden"
        />
        <img
          src={vercelDarkSvg}
          alt="Vercel"
          className="w-[220px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          TanStack Router/Start and Vercel are a match made in heaven. Vercel's{' '}
          <strong>cutting-edge deployment and serverless capabilities</strong>{' '}
          continue to deliver on the TanStack promise for apps to be{' '}
          <strong>high-performant and scalable</strong>. We're working closely
          with Vercel to not only ensure a flawless deployment experience, but
          also push the boundaries of what's possible with TanStack on the web.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const prisma = (() => {
  const href = 'https://www.prisma.io/?utm_source=tanstack&via=tanstack'

  return {
    name: 'Prisma',
    id: 'prisma',
    href,
    sidebarImgLight: prismaLightSvg,
    sidebarImgDark: prismaDarkSvg,
    sidebarImgClass: 'py-4',
    status: 'active' as const,
    libraries: ['db'] as const,
    startDate: 'Aug 2025',
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-12">
        <img
          src={prismaLightSvg}
          alt="Prisma"
          className="w-[220px] max-w-full dark:hidden"
        />
        <img
          src={prismaDarkSvg}
          alt="Prisma"
          className="w-[220px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          TanStack and Prisma Postgres: Skip the database setup, get to
          building. Prisma Postgres provisions production-ready Postgres
          databases in seconds—no resource config, no infrastructure planning,
          no late-night "why is my connection pool maxed out?" debugging
          sessions. Just connect your TanStack app and start building features
          that matter.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const codeRabbit = (() => {
  const href =
    'https://coderabbit.link/tanstack?utm_source=tanstack&via=tanstack'

  return {
    name: 'Code Rabbit',
    id: 'coderabbit',
    href,
    sidebarImgLight: codeRabbitLightSvg,
    sidebarImgDark: codeRabbitDarkSvg,
    sidebarImgClass: 'py-5 scale-[1.2]',
    status: 'active' as const,
    libraries: libraries.map((l) => l.id),
    startDate: 'Aug 2025',
    homepageImg: (
      <div className="w-full h-full flex items-center justify-center px-4 py-12">
        <img
          src={codeRabbitLightSvg}
          alt="Code Rabbit"
          className="w-[350px] max-w-full dark:hidden"
        />
        <img
          src={codeRabbitDarkSvg}
          alt="Code Rabbit"
          className="w-[350px] max-w-full hidden dark:block"
        />
      </div>
    ),
    content: (
      <>
        <div className="text-xs">
          TanStack leverages CodeRabbit to{' '}
          <strong>
            enhance our code review process, significantly reducing review times
            and improving code quality
          </strong>
          . By integrating CodeRabbit's advanced AI capabilities, we ensure that
          our pull requests are thoroughly analyzed for potential issues, from
          readability to logic bugs. This allows our team to{' '}
          <strong>
            focus on meaningful code discussions and innovation, while
            maintaining high standards of code quality and security
          </strong>
          . With CodeRabbit, we benefit from intelligent, automated reviews that
          adapt to our workflows, making our development process faster and more
          efficient.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

export const partners: Partner[] = [
  codeRabbit,
  agGrid,
  netlify,
  neon,
  clerk,
  convex,
  electric,
  sentry,
  prisma,
  unkey,
  uiDev,
  nozzle,
  vercel,
  speakeasy,
] as any

if (typeof window !== 'undefined') {
  ;(window as any).githubPartnersSnippet = partners
    .filter((d) => d.href && (d.sidebarImgLight || d.sidebarImgDark))
    .map((partner) => {
      return `<div><a href="${partner.href}">
  <img alt="${partner.name}" src="https://raw.githubusercontent.com/tannerlinsley/files/master/partners/${partner.id}.svg" height="40"
</a></div><br />`
    })
    .join('\n')
}
