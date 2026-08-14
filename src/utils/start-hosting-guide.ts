import type { Partner } from '~/utils/partners'
import type { BlockNode, MarkdownDocument } from '@tanstack/markdown'

const hostingPartnersElement =
  '<start-hosting-partners></start-hosting-partners>'
const lovableLogoElement =
  '<start-hosting-lovable-logo></start-hosting-lovable-logo>'

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
]

const hostingPartnersElementPattern =
  /^\s*<start-hosting-partners>\s*<\/start-hosting-partners>\s*$/i
const lovableLogoElementPattern =
  /^\s*<start-hosting-lovable-logo>\s*<\/start-hosting-lovable-logo>\s*$/i

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
  const otherSections = sections.slice(firstOtherSectionIndex)

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
  if (!heading.toLowerCase().includes('official partner')) {
    return undefined
  }

  const normalizedHeading = normalizeName(heading)

  return partners.find((partner) =>
    normalizedHeading.startsWith(normalizeName(partner.name)),
  )?.id
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
