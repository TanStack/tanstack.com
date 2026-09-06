import type { Partner } from '~/utils/partners'
import type { BlockNode, MarkdownDocument } from '@tanstack/markdown'

const hostingPartnersElement =
  '<start-hosting-partners></start-hosting-partners>'
const lovableLogoElement =
  '<start-hosting-lovable-logo></start-hosting-lovable-logo>'
const renderLogoElement =
  '<start-hosting-render-logo></start-hosting-render-logo>'
const vercelLogoElement =
  '<start-hosting-vercel-logo></start-hosting-vercel-logo>'

type HostingPartner = Pick<Partner, 'id' | 'name'>

type HostingGuideSection = {
  content: string
  isOfficialPartner: boolean
  partnerId?: string
}

const generatedHostingPartnerSections: Array<HostingGuideSection> = [
  {
    content: `### Lovable ⭐ _Official Partner_

${lovableLogoElement}

Lovable is different from a general-purpose deployment target: it is an AI app builder with hosting built into the same workflow. New Lovable SSR projects use TanStack Start, and publishing deploys the generated app to Lovable Cloud.

Create a project in [Lovable](https://lovable.dev/?utm_source=tanstack), describe the app, then use **Publish** when it is ready. Connect the project to [GitHub](https://docs.lovable.dev/integrations/github) if you want to work on the code locally or deploy it somewhere else.`,
    isOfficialPartner: true,
    partnerId: 'lovable',
  },
  {
    content: `### Vercel ⭐ _Official Partner_

${vercelLogoElement}

Vercel supports TanStack Start through Nitro. Once Nitro is configured, Vercel detects the framework and supplies the build command and output settings.

For a new app, let the TanStack CLI add the current Vercel setup:

\`\`\`bash
npx @tanstack/cli@latest create my-tanstack-app --deployment vercel
\`\`\`

For an existing Vite app, install Nitro and add its Vite plugin:

\`\`\`bash
pnpm add nitro
\`\`\`

\`\`\`ts
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), nitro(), viteReact()],
})
\`\`\`

The TanStack CLI also adds a \`vercel.json\` file so framework detection is explicit:

\`\`\`json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "tanstack-start"
}
\`\`\`

Import the Git repository in [Vercel](https://vercel.com/new?utm_source=tanstack&utm_medium=referral&utm_campaign=gold-launch), or deploy it with \`npx vercel\`. Add secrets under **Settings > Environment Variables** without a \`VITE_\` prefix, since \`VITE_\` values are included in browser code.

See Vercel's [TanStack Start deployment guide](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel) for framework detection, Git deployments, preview deployments, and environment configuration.`,
    isOfficialPartner: true,
    partnerId: 'vercel',
  },
  {
    content: `### Render ⭐ _Official Partner_

${renderLogoElement}

TanStack Start runs on Render as a Node web service built with Nitro. The TanStack CLI can add the current Nitro setup, start script, and Render Blueprint:

\`\`\`bash
npx @tanstack/cli@latest create my-tanstack-app --deployment render
\`\`\`

For an existing Vite app, install Nitro, add \`nitro()\` to the Vite plugins as shown in the [Nitro guide](#nitro), and make sure \`package.json\` has a production start script:

\`\`\`json
{
  "scripts": {
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
\`\`\`

Add this \`render.yaml\` Blueprint at the repository root, adjusting the package manager commands when needed:

\`\`\`yaml
services:
  - type: web
    runtime: node
    name: tanstack-start-app
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
    envVars:
      - key: NITRO_PRESET
        value: render-com
      - key: HOST
        value: 0.0.0.0
\`\`\`

Push the repository to GitHub, GitLab, or Bitbucket, then choose **New > Blueprint** in [Render](https://dashboard.render.com/select-repo?type=blueprint&utm_source=tanstack&utm_medium=referral&utm_campaign=gold-launch). Render supplies \`PORT\`, and Nitro reads it at runtime. Add secret environment values in the Render Dashboard instead of committing them to \`render.yaml\`.

See Render's [Blueprint documentation](https://render.com/docs/infrastructure-as-code) and [environment variable documentation](https://render.com/docs/configure-environment-variables) for more configuration options.`,
    isOfficialPartner: true,
    partnerId: 'render',
  },
]

const generatedHostingPartnerIds = new Set(
  generatedHostingPartnerSections.flatMap((section) =>
    section.partnerId ? [section.partnerId] : [],
  ),
)

const hostingPartnersElementPattern =
  /^\s*<start-hosting-partners>\s*<\/start-hosting-partners>\s*$/i
const lovableLogoElementPattern =
  /^\s*<start-hosting-lovable-logo>\s*<\/start-hosting-lovable-logo>\s*$/i
const renderLogoElementPattern =
  /^\s*<start-hosting-render-logo>\s*<\/start-hosting-render-logo>\s*$/i
const vercelLogoElementPattern =
  /^\s*<start-hosting-vercel-logo>\s*<\/start-hosting-vercel-logo>\s*$/i

export function isStartHostingGuide({
  filePath,
  libraryId,
}: {
  filePath: string
  libraryId?: string
}) {
  return libraryId === 'start' && filePath.endsWith('/guide/hosting.md')
}

export function renderDynamicStartHostingGuide(
  content: string,
  orderedPartners: Array<HostingPartner>,
) {
  const recommendationStart = content.search(/^## What should I use\?\s*$/m)
  const deploymentStart = content.search(/^## Deployment\s*$/m)

  if (recommendationStart === -1 || deploymentStart === -1) {
    return content
  }

  const deploymentContent = content.slice(deploymentStart)
  const sections = splitLevelThreeSections(deploymentContent, orderedPartners)
  const firstPartnerSectionIndex = sections.findIndex(
    (section) => section.isOfficialPartner,
  )

  if (firstPartnerSectionIndex === -1) {
    return content
  }

  const firstOtherSectionIndex = sections.findIndex(
    (section, index) =>
      index > firstPartnerSectionIndex && !section.isOfficialPartner,
  )

  if (firstOtherSectionIndex === -1) {
    return content
  }

  const partnerSections = sections.slice(
    firstPartnerSectionIndex,
    firstOtherSectionIndex,
  )

  const partnerSectionById = new Map(
    [...generatedHostingPartnerSections, ...partnerSections]
      .filter((section) => section.partnerId !== undefined)
      .map((section) => [section.partnerId, section]),
  )
  const orderedPartnerSections = orderedPartners
    .map((partner) => partnerSectionById.get(partner.id))
    .filter((section) => section !== undefined)
  const orderedPartnerIds = new Set(
    orderedPartnerSections.map((section) => section.partnerId),
  )
  const unmatchedPartnerSections = partnerSections.filter(
    (section) => !orderedPartnerIds.has(section.partnerId),
  )
  const otherSections = sections
    .slice(firstOtherSectionIndex)
    .filter(
      (section) =>
        !section.partnerId ||
        !generatedHostingPartnerIds.has(section.partnerId),
    )

  return [
    content.slice(0, recommendationStart).trimEnd(),
    `## Hosting partners\n\n${hostingPartnersElement}`,
    `## Deployment guides\n\n${[
      ...orderedPartnerSections,
      ...unmatchedPartnerSections,
    ]
      .map((section) => section.content)
      .join('\n\n')}`,
    `## Other deployment targets\n\n${otherSections
      .map((section) => section.content)
      .join('\n\n')}`,
  ].join('\n\n')
}

export function mapStartHostingPartnerElements(
  document: MarkdownDocument,
): MarkdownDocument {
  return {
    ...document,
    children: document.children.map((block) => {
      if (block.type !== 'html') {
        return block
      }

      if (hostingPartnersElementPattern.test(block.value)) {
        return createComponentBlock('start-hosting-partners')
      }

      if (lovableLogoElementPattern.test(block.value)) {
        return createComponentBlock('start-hosting-lovable-logo')
      }

      if (renderLogoElementPattern.test(block.value)) {
        return createComponentBlock('start-hosting-render-logo')
      }

      if (vercelLogoElementPattern.test(block.value)) {
        return createComponentBlock('start-hosting-vercel-logo')
      }

      return block
    }),
  }
}

function createComponentBlock(name: string): BlockNode {
  return {
    type: 'component',
    name,
    tagName: name,
    attributes: {},
    properties: {},
    children: [],
  }
}

function splitLevelThreeSections(
  content: string,
  partners: Array<HostingPartner>,
) {
  const matches = Array.from(content.matchAll(/^### (.+)\s*$/gm))

  return matches.map((match, index): HostingGuideSection => {
    const start = match.index
    const end = matches[index + 1]?.index ?? content.length
    const heading = match[1]?.trim() ?? ''

    return {
      content: content.slice(start, end).trim(),
      isOfficialPartner: heading.toLowerCase().includes('official partner'),
      partnerId: findHeadingPartnerId(heading, partners),
    }
  })
}

function findHeadingPartnerId(
  heading: string,
  partners: Array<HostingPartner>,
) {
  const normalizedHeading = normalizeName(heading)

  return partners.find((partner) =>
    normalizedHeading.startsWith(normalizeName(partner.name)),
  )?.id
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
