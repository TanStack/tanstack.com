import { getPartnerById, type Partner } from '~/utils/partners'

const RAILWAY_PARTNER_ID = 'railway'
const RAILWAY_DEPLOYMENT_ID = 'railway'
const RAILWAY_DOCS_HASH = 'railway-official-partner'
const RAILWAY_CREATE_COMMAND = `npx @tanstack/cli@latest create my-tanstack-app --deployment ${RAILWAY_DEPLOYMENT_ID}`

export function createRailwayPartnerPageModel(partner: Partner | undefined) {
  if (!partner || partner.id !== RAILWAY_PARTNER_ID) {
    throw new Error('The Railway partner page requires the Railway record')
  }

  const docsResource = partner.resources?.find(
    (resource) =>
      resource.kind === 'documentation' &&
      resource.href.startsWith('/start/') &&
      resource.href.includes('/guide/hosting'),
  )

  if (!docsResource) {
    throw new Error(
      'The Railway partner page requires a TanStack Start hosting resource',
    )
  }

  return {
    create: {
      command: RAILWAY_CREATE_COMMAND,
      deploymentId: RAILWAY_DEPLOYMENT_ID,
    },
    docsHash: RAILWAY_DOCS_HASH,
    docsResource,
    partner,
  }
}

export function getRailwayPartnerPageModel() {
  return createRailwayPartnerPageModel(getPartnerById(RAILWAY_PARTNER_ID))
}
