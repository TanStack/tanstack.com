import { partners, partnerTierLabels } from '~/utils/partners'
import { getPartnerTierGroupsForPlacement } from '~/utils/partner-placement'
import { usePartnerPlacementContext } from '~/utils/usePartnerPlacementContext'

const contributions: Record<string, { href: string; description: string }> = {
  clerk: {
    href: 'https://clerk.com/docs/reference/tanstack-react-start/overview',
    description:
      'built a dedicated TanStack Start SDK, with authentication components and helpers for both the client and server.',
  },
  workos: {
    href: 'https://workos.com/docs/sdks/authkit-tanstack-start',
    description:
      'built an AuthKit package for TanStack Start, with authentication, session management, and route protection.',
  },
  'ag-grid': {
    href: 'https://tanstack.com/blog/ag-grid-partnership',
    description:
      'has supported TanStack for years through its Table partnership, helping fund the broader open-source work we do.',
  },
  serpapi: {
    href: 'https://github.com/serpapi/local-llm-web-search',
    description:
      'published a Start application that gives a local language model web search, with the source available to build on.',
  },
  openrouter: {
    href: 'https://tanstack.com/blog/openrouter-partnership',
    description:
      'supports the wider TanStack ecosystem through sponsorship and our work together on AI tooling.',
  },
  sentry: {
    href: 'https://github.com/getsentry/sentry-javascript/tree/develop/packages/tanstackstart-react',
    description:
      'built a dedicated TanStack Start SDK to help developers monitor errors and performance in their applications.',
  },
  prisma: {
    href: 'https://docs.prisma.io/docs/guides/frameworks/tanstack-start',
    description:
      'created Start scaffolding and a database guide that connects Prisma to server functions and route loaders.',
  },
  electric: {
    href: 'https://electric.ax/blog/2025/07/29/super-fast-apps-on-sync-with-tanstack-db',
    description:
      'published examples of building with Start, TanStack DB, and Electric sync to keep application data up to date.',
  },
  unkey: {
    href: 'https://github.com/unkeyed/unkey/blob/d00fc71f507640eb1cdddef4ca7f8eda773a8cd9/web/apps/portal/package.json',
    description:
      'adopted Start, Router, and Query in its open-source portal, putting the stack to work in its own codebase.',
  },
  cloudflare: {
    href: 'https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/',
    description:
      'built a path to running Start on Workers, with a project generator and Vite integration.',
  },
  coderabbit: {
    href: 'https://github.com/TanStack/router/pull/6996',
    description:
      'helps review changes in the Router and Start repo, including catching cookie-handling issues in the preview server.',
  },
  lovable: {
    href: 'https://lovable.dev/blog/building-apps-using-tanstack-start',
    description:
      'chose Start to power newly generated applications, bringing server rendering and typed server functions to its users.',
  },
  netlify: {
    href: 'https://app.netlify.com/start',
    description:
      'backed Start development and made it the default for its app builder, where you describe what you want and an agent builds it.',
  },
  railway: {
    href: 'https://railway.com/deploy/tanstack-start',
    description:
      'published a Start deployment template so developers can get a full-stack application running on Railway.',
  },
  render: {
    href: 'https://render.com/templates/tanstack-start',
    description:
      'built a Start deployment template with server rendering, server functions, and health checks already wired up.',
  },
  vercel: {
    href: 'https://vercel.com/docs/frameworks/full-stack/tanstack-start',
    description:
      'added Start deployment support through Nitro, with a starter template and automatic scaling on Fluid compute.',
  },
}

export function StartPartnerContributions() {
  const context = usePartnerPlacementContext({
    orderStrategy: 'tier-rotated',
    surface: 'start-1-0-contributions',
  })
  const partnerGroups = getPartnerTierGroupsForPlacement(
    partners.flatMap((partner) => {
      const contribution = contributions[partner.id]
      return partner.status === 'active' && contribution
        ? [{ ...partner, contribution }]
        : []
    }),
    context,
  )

  return (
    <div>
      {partnerGroups.map(({ tier, partners: tierPartners }) => (
        <section key={tier}>
          <h3>{partnerTierLabels[tier]}</h3>
          <ul>
            {tierPartners.map(({ id, name, contribution }) => (
              <li key={id}>
                <a href={contribution.href}>{name}</a>{' '}
                {contribution.description}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
