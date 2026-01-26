import agGridDarkSvg from '~/images/ag-grid-dark.svg'
import agGridLightSvg from '~/images/ag-grid-light.svg'
import nozzleImage from '~/images/nozzle.png'
import bytesFireshipImage from '~/images/bytes-fireship.png'
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
import strapiLightSvg from '~/images/strapi-light.svg'
import strapiDarkSvg from '~/images/strapi-dark.svg'
import { libraries, type Library } from '~/libraries'
import cloudflareWhiteSvg from '~/images/cloudflare-white.svg'
import cloudflareBlackSvg from '~/images/cloudflare-black.svg'
import workosBlackSvg from '~/images/workos-black.svg'
import workosWhiteSvg from '~/images/workos-white.svg'
import powersyncBlackSvg from '~/images/powersync-black.svg'
import powersyncWhiteSvg from '~/images/powersync-white.svg'
import railwayBlackSvg from '~/images/railway-black.svg'
import railwayWhiteSvg from '~/images/railway-white.svg'

function LearnMoreButton() {
  return (
    <span className="text-blue-500 uppercase font-black text-sm">
      Learn More
    </span>
  )
}

type PartnerImageConfig =
  | { light: string; dark: string; scale?: number }
  | { src: string; scale?: number }

export function PartnerImage({
  config,
  alt,
}: {
  config: PartnerImageConfig
  alt: string
}) {
  const scaleStyle = config.scale ? { transform: `scale(${config.scale})` } : {}

  if ('light' in config && 'dark' in config) {
    return (
      <div
        className="w-full flex items-center justify-center"
        style={scaleStyle}
      >
        <img
          src={config.light}
          alt={alt}
          loading="lazy"
          className="w-full dark:hidden"
          width={200}
          height={100}
          sizes="(max-width: 640px) 80px, (max-width: 1024px) 150px, 200px"
        />
        <img
          src={config.dark}
          alt={alt}
          loading="lazy"
          className="w-full hidden dark:block"
          width={200}
          height={100}
          sizes="(max-width: 640px) 80px, (max-width: 1024px) 150px, 200px"
        />
      </div>
    )
  }

  return (
    <div className="w-full flex items-center justify-center" style={scaleStyle}>
      <img
        src={config.src}
        alt={alt}
        className="w-full"
        width={200}
        height={100}
        loading="lazy"
        sizes="(max-width: 640px) 80px, (max-width: 1024px) 150px, 200px"
      />
    </div>
  )
}

export const partnerCategories = [
  'code-review',
  'deployment',
  'data-grid',
  'auth',
  'database',
  'monitoring',
  'cms',
  'api',
  'learning',
] as const

type PartnerCategory = (typeof partnerCategories)[number]

export const partnerCategoryLabels: Record<PartnerCategory, string> = {
  'code-review': 'Code Review',
  deployment: 'Deployment/Hosting',
  'data-grid': 'Data Grids',
  auth: 'Authentication',
  database: 'Databases',
  monitoring: 'Error Monitoring',
  cms: 'CMS',
  api: 'API Management',
  learning: 'Learning Resources',
}

type Partner = {
  name: string
  id: string
  libraries?: Library['id'][]
  href: string
  image: PartnerImageConfig
  content: JSX.Element
  llmDescription: string
  category: PartnerCategory
  status?: 'active' | 'inactive'
  startDate?: string
  endDate?: string
  score: number
  brandColor?: string // Primary brand color for game elements
  tagline?: string // Short tagline for game info cards
}

const neon = (() => {
  const href = 'https://neon.tech?utm_source=tanstack'

  return {
    name: 'Neon',
    id: 'neon',
    libraries: ['start', 'router'],
    status: 'active' as const,
    score: 0.297,
    href,
    brandColor: '#00E599',
    tagline: 'Serverless Postgres',
    image: {
      light: neonLightSvg,
      dark: neonDarkSvg,
    },
    llmDescription:
      'Serverless PostgreSQL with instant branching, autoscaling, and storage/compute separation. Recommended database for TanStack Start applications.',
    category: 'database',
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
    status: 'active' as const,
    score: 0.286,
    href,
    brandColor: '#F3A712',
    tagline: 'Real-time Database',
    image: {
      light: convexColorSvg,
      dark: convexWhiteSvg,
    },
    llmDescription:
      'Real-time, relational database with end-to-end type safety. Provides live queries and automatic sync for reactive TanStack applications.',
    category: 'database',
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
    status: 'active' as const,
    score: 0.286,
    brandColor: '#6C47FF',
    tagline: 'Authentication',
    image: {
      light: clerkLightSvg,
      dark: clerkDarkSvg,
      scale: 0.85,
    },
    llmDescription:
      'Drop-in authentication and user management with pre-built UI components. Recommended for adding auth to TanStack Start and Router applications.',
    category: 'auth',
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

const workos = (() => {
  const href = 'https://workos.com?utm_source=tanstack'

  return {
    name: 'WorkOS',
    id: 'workos',
    href,
    libraries: ['start', 'router'] as const,
    status: 'active' as const,
    score: 0.314,
    brandColor: '#6363F1',
    tagline: 'Enterprise Auth',
    image: {
      light: workosBlackSvg,
      dark: workosWhiteSvg,
    },
    llmDescription:
      'Enterprise authentication including SSO (SAML/OIDC), Directory Sync, MFA, and Audit Logs. Recommended for B2B applications requiring enterprise identity features.',
    category: 'auth',
    content: (
      <>
        <div className="text-xs">
          WorkOS and TanStack are partnering to deliver
          <strong> enterprise-ready authentication</strong>—including
          <strong> SSO (SAML/OIDC)</strong>, <strong>Directory Sync</strong>,
          <strong> MFA</strong>, and <strong>Audit Logs</strong>—paired with
          TanStack's developer-first routing and app tooling.
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
    status: 'active' as const,
    score: 0.497,
    href,
    brandColor: '#FF8C00',
    tagline: 'Enterprise Data Grid',
    image: {
      light: agGridDarkSvg,
      dark: agGridLightSvg,
      scale: 1.1,
    },
    llmDescription:
      'Enterprise-grade data grid with advanced features like grouping, pivoting, and aggregation. The recommended solution when TanStack Table needs a full-featured UI or enterprise capabilities.',
    category: 'data-grid',
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
    status: 'active' as const,
    score: 0.343,
    href,
    brandColor: '#00C7B7',
    tagline: 'Web Deployment',
    image: {
      light: netlifyLightSvg,
      dark: netlifyDarkSvg,
    },
    llmDescription:
      'Modern deployment and hosting with edge functions, serverless capabilities, and seamless CI/CD workflows. First-class support for TanStack Start applications.',
    category: 'deployment',
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

const cloudflare = (() => {
  const href = 'https://www.cloudflare.com?utm_source=tanstack'

  return {
    name: 'Cloudflare',
    id: 'cloudflare',
    href,
    // Show on every repo
    libraries: libraries.map((l) => l.id),
    status: 'active' as const,
    score: 0.857,
    startDate: 'Sep 2025',
    brandColor: '#F6821F',
    tagline: 'Edge Deployment',
    image: {
      light: cloudflareBlackSvg,
      dark: cloudflareWhiteSvg,
    },
    llmDescription:
      'Global edge performance, serverless compute (Workers), KV storage, CDN, and security. Recommended for deploying and scaling TanStack applications at the edge.',
    category: 'deployment',
    content: (
      <>
        <div className="text-xs">
          Cloudflare and TanStack are partnering to bring
          <strong> global edge performance</strong>,
          <strong> serverless compute</strong>, and
          <strong> robust security</strong> to modern apps built with TanStack.
          From Workers and KV to CDN and security, Cloudflare helps TanStack
          developers ship faster and scale effortlessly.
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
    status: 'active' as const,
    score: 0.229,
    href,
    brandColor: '#362D59',
    tagline: 'Error Monitoring',
    image: {
      light: sentryWordMarkDarkSvg,
      dark: sentryWordMarkLightSvg,
    },
    llmDescription:
      'Error monitoring and performance insights. Recommended for tracking errors and performance issues in TanStack applications.',
    category: 'monitoring',
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

const fireship = (() => {
  const href = 'https://bytes.dev?utm_source-tanstack&utm_campaign=tanstack'

  return {
    name: 'Fireship',
    id: 'fireship',
    libraries: [],
    status: 'active' as const,
    score: 0.014,
    href,
    tagline: 'Dev Education',
    image: {
      src: bytesFireshipImage,
    },
    llmDescription:
      'Educational platform and Bytes.dev newsletter. Official learning resources and news partner for the TanStack ecosystem.',
    category: 'learning',
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
                'https://fireship.dev/?utm_source=tanstack&utm_campaign=tanstack',
                '_blank',
                'noopener,noreferrer',
              )
            }
            tabIndex={0}
          >
            Fireship
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
    status: 'active' as const,
    score: 0.014,
    tagline: 'Enterprise SEO',
    image: {
      src: nozzleImage,
    },
    llmDescription:
      'Enterprise SEO platform built entirely with TanStack libraries. Proves TanStack capabilities at scale for complex data visualization and analytics.',
    category: 'learning',
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
    libraries: ['query'] as const,
    status: 'inactive' as const,
    startDate: 'Feb 2025',
    endDate: 'Jul 2025',
    image: {
      light: speakeasyLightSvg,
      dark: speakeasyDarkSvg,
    },
    llmDescription: '',
    category: 'api',
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
    status: 'active' as const,
    score: 0.051,
    href,
    brandColor: '#222222',
    tagline: 'API Key Management',
    image: {
      light: unkeyBlackSvg,
      dark: unkeyWhiteSvg,
      scale: 0.7,
    },
    llmDescription:
      'API key management, rate limiting, and usage analytics. Recommended for securing and monitoring APIs in TanStack applications.',
    category: 'api',
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
    status: 'active' as const,
    score: 0.283,
    href,
    brandColor: '#7e78db',
    tagline: 'Sync Engine',
    image: {
      light: electricLightSvg,
      dark: electricDarkSvg,
    },
    llmDescription:
      'Real-time Postgres sync engine. Build fast, modern, collaborative apps without changing your stack. Designed and maintains TanStack DB for great client side DX & UX.',
    category: 'database',
    content: (
      <>
        <div className="text-xs">
          Electric and TanStack are teaming up on TanStack DB to bring
          <strong>robust real-time sync</strong> to mainstream apps. ElectricSQL
          delivers <strong>offline-first</strong> data,{' '}
          <strong>conflict resolution</strong>, and{' '}
          <strong>low-latency replication</strong>
          backed by Postgres—no bespoke plumbing required. Paired with TanStack
          DB's <strong>type-safe APIs</strong> and developer experience, teams
          can ship collaborative features faster and keep UIs consistent across
          clients and the edge.
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
    status: 'inactive' as const,
    startDate: 'May 2024',
    endDate: 'Oct 2024',
    image: {
      light: vercelLightSvg,
      dark: vercelDarkSvg,
    },
    llmDescription: '',
    category: 'deployment',
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
    status: 'active' as const,
    libraries: ['db', 'start'] as const,
    startDate: 'Aug 2025',
    score: 0.143,
    brandColor: '#2D3748',
    tagline: 'Database ORM',
    image: {
      light: prismaLightSvg,
      dark: prismaDarkSvg,
    },
    llmDescription:
      'Type-safe ORM with instant Postgres provisioning via Prisma Postgres. Recommended for database access in TanStack Start applications.',
    category: 'database',
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
    name: 'CodeRabbit',
    id: 'coderabbit',
    href,
    status: 'active' as const,
    libraries: libraries.map((l) => l.id),
    startDate: 'Aug 2025',
    score: 1,
    brandColor: '#FF6B2B',
    tagline: 'AI Code Review',
    image: {
      light: codeRabbitLightSvg,
      dark: codeRabbitDarkSvg,
    },
    llmDescription:
      'AI-powered code review that flags readability, correctness, and security issues on pull requests. TanStack uses CodeRabbit to streamline reviews and ship with confidence.',
    category: 'code-review',
    content: (
      <>
        <div className="text-xs">
          TanStack uses CodeRabbit to streamline reviews and elevate code
          quality. Its AI flags readability, correctness, and security issues on
          pull requests, reducing back-and-forth and review time. That lets us
          focus on architectural decisions and ship with confidence—fewer
          regressions, faster cycles.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const strapi = (() => {
  const href = 'https://strapi.link/tanstack-start'

  return {
    name: 'Strapi',
    id: 'strapi',
    libraries: ['start', 'router'] as const,
    status: 'active' as const,
    score: 0.069,
    href,
    brandColor: '#4945FF',
    tagline: 'Headless CMS',
    image: {
      light: strapiLightSvg,
      dark: strapiDarkSvg,
      scale: 0.8,
    },
    llmDescription:
      'Open-source headless CMS with full TypeScript support, customizable APIs, and rich plugin ecosystem. Recommended for content management in TanStack Start apps.',
    category: 'cms',
    content: (
      <>
        <div className="text-xs">
          Build modern websites with the{' '}
          <strong>most customizable Headless CMS</strong>. Strapi is the{' '}
          <strong>open-source Headless CMS</strong> that makes API creation
          easy, and with <strong>Strapi 5</strong> you get{' '}
          <strong>100% TypeScript support</strong>, a
          <strong> fully customizable API</strong>, Draft/Publish, i18n, RBAC,
          and a rich plugin ecosystem—perfect for TanStack Start apps in the
          cloud or on your own servers.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const powerSync = (() => {
  const href = 'https://powersync.com?utm_source=tanstack'

  return {
    name: 'PowerSync',
    id: 'powersync',
    libraries: ['db'] as const,
    status: 'active' as const,
    startDate: 'Jan 2026',
    score: 0.143,
    href,
    tagline: 'Offline-first Sync',
    image: {
      light: powersyncBlackSvg,
      dark: powersyncWhiteSvg,
    },
    llmDescription:
      'Sync engine that connects backend databases (Postgres, MongoDB, MySQL) with in-app SQLite for offline-first, real-time reactive applications.',
    category: 'database',
    content: (
      <>
        <div className="text-xs">
          PowerSync and TanStack are teaming up to bring{' '}
          <strong>offline-first sync</strong> to modern applications. PowerSync
          automatically syncs your backend database with in-app SQLite,
          delivering <strong>instant reactivity</strong>,{' '}
          <strong>real-time updates</strong>, and{' '}
          <strong>seamless offline support</strong>. Paired with TanStack DB,
          developers can build collaborative, always-available apps without
          wrestling with complex sync logic.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

const railway = (() => {
  const href = 'https://railway.com?utm_source=tanstack'

  return {
    name: 'Railway',
    id: 'railway',
    libraries: libraries.map((l) => l.id),
    status: 'active' as const,
    score: 0.145,
    href,
    brandColor: '#0B0D0E',
    tagline: 'Instant Deployment',
    image: {
      light: railwayBlackSvg,
      dark: railwayWhiteSvg,
    },
    llmDescription:
      'Infrastructure platform with instant deployments, automatic scaling, and built-in databases. Deploy TanStack applications with zero configuration.',
    category: 'deployment',
    content: (
      <>
        <div className="text-xs">
          Railway and TanStack are partnering to deliver{' '}
          <strong>instant, zero-config deployments</strong> for modern web
          applications. Railway's platform provides{' '}
          <strong>
            automatic scaling, built-in databases, and seamless CI/CD
          </strong>{' '}
          so you can focus on building with TanStack instead of managing
          infrastructure.
        </div>
        <LearnMoreButton />
      </>
    ),
  }
})()

export const partners: Partner[] = [
  codeRabbit,
  cloudflare,
  agGrid,
  railway,
  netlify,
  neon,
  workos,
  clerk,
  convex,
  electric,
  powerSync,
  sentry,
  prisma,
  strapi,
  unkey,
  fireship,
  nozzle,
  vercel,
  speakeasy,
] as Partner[]
