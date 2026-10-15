import { getPartnerById, type Partner } from '~/utils/partners'

const RENDER_PARTNER_ID = 'render'
const RENDER_DEPLOYMENT_ID = 'render'
const RENDER_DOCS_HASH = 'render-official-partner'
const RENDER_CREATE_COMMAND = `npx @tanstack/cli@latest create my-tanstack-app --deployment ${RENDER_DEPLOYMENT_ID}`

export function createRenderPartnerPageModel(partner: Partner | undefined) {
  if (!partner || partner.id !== RENDER_PARTNER_ID) {
    throw new Error('The Render partner page requires the Render record')
  }

  const docsResource = partner.resources?.find(
    (resource) =>
      resource.kind === 'documentation' &&
      resource.href.startsWith('/start/') &&
      resource.href.includes('/guide/hosting'),
  )

  if (!docsResource) {
    throw new Error(
      'The Render partner page requires a TanStack Start hosting resource',
    )
  }

  return {
    create: {
      command: RENDER_CREATE_COMMAND,
      deploymentId: RENDER_DEPLOYMENT_ID,
    },
    docsHash: RENDER_DOCS_HASH,
    docsResource,
    partner,
  }
}

export function getRenderPartnerPageModel() {
  return createRenderPartnerPageModel(getPartnerById(RENDER_PARTNER_ID))
}
