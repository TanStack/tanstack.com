import { getPartnerById, type Partner } from '~/utils/partners'

const VERCEL_PARTNER_ID = 'vercel'
const VERCEL_DEPLOYMENT_ID = 'vercel'
const VERCEL_DOCS_HASH = 'vercel-official-partner'
const VERCEL_CREATE_COMMAND = `npx @tanstack/cli@latest create my-tanstack-app --deployment ${VERCEL_DEPLOYMENT_ID}`

export function createVercelPartnerPageModel(partner: Partner | undefined) {
  if (!partner || partner.id !== VERCEL_PARTNER_ID) {
    throw new Error('The Vercel partner page requires the Vercel record')
  }

  const docsResource = partner.resources?.find(
    (resource) =>
      resource.kind === 'documentation' &&
      resource.href.startsWith('/start/') &&
      resource.href.includes('/guide/hosting'),
  )

  if (!docsResource) {
    throw new Error(
      'The Vercel partner page requires a TanStack Start hosting resource',
    )
  }

  return {
    create: {
      command: VERCEL_CREATE_COMMAND,
      deploymentId: VERCEL_DEPLOYMENT_ID,
    },
    docsHash: VERCEL_DOCS_HASH,
    docsResource,
    partner,
  }
}

export function getVercelPartnerPageModel() {
  return createVercelPartnerPageModel(getPartnerById(VERCEL_PARTNER_ID))
}
