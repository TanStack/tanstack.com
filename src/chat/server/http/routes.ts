import route48 from '~/chat/server/http/api/chat/kody/memories/create/apply'
import route49 from '~/chat/server/http/api/chat/kody/memories/create/review'
import route43 from '~/chat/server/http/api/chat/kody/mail/messages/$messageId'
import route42 from '~/chat/server/http/api/chat/kody/mail/inboxes'
import route44 from '~/chat/server/http/api/chat/kody/mail/messages'
import route79 from '~/chat/server/http/api/chat/references/kody/inspect'
import route80 from '~/chat/server/http/api/chat/references/kody/refresh'
import route81 from '~/chat/server/http/api/chat/references/tools/refresh'
import route41 from '~/chat/server/http/api/chat/kody/jobs/$jobId/enabled'
import route45 from '~/chat/server/http/api/chat/kody/memories/$memoryId/apply'
import route46 from '~/chat/server/http/api/chat/kody/memories/$memoryId/review'
import route51 from '~/chat/server/http/api/chat/kody/packages/$packageId/document'
import route53 from '~/chat/server/http/api/chat/kody/runs/$runId/triage'
import route56 from '~/chat/server/http/api/chat/kody/servers/$serverId/check'
import route57 from '~/chat/server/http/api/chat/kody/servers/$serverId/enabled'
import route58 from '~/chat/server/http/api/chat/kody/servers/$serverId/reconnect'
import route0 from '~/chat/server/http/api/chat/account/composer-drafts/$accountId.$scope'
import route38 from '~/chat/server/http/api/chat/kody/community/$listingId'
import route47 from '~/chat/server/http/api/chat/kody/memories/$memoryId'
import route52 from '~/chat/server/http/api/chat/kody/resources/$kind'
import route54 from '~/chat/server/http/api/chat/kody/runs/$runId'
import route1 from '~/chat/server/http/api/chat/account/devices'
import route2 from '~/chat/server/http/api/chat/account/onboarding'
import route3 from '~/chat/server/http/api/chat/account/preferences'
import route16 from '~/chat/server/http/api/chat/bots/bulk'
import route17 from '~/chat/server/http/api/chat/bots/move'
import route36 from '~/chat/server/http/api/chat/kody/account'
import route37 from '~/chat/server/http/api/chat/kody/callback'
import route39 from '~/chat/server/http/api/chat/kody/community'
import route40 from '~/chat/server/http/api/chat/kody/connect'
import route50 from '~/chat/server/http/api/chat/kody/memories'
import route55 from '~/chat/server/http/api/chat/kody/runs'
import route59 from '~/chat/server/http/api/chat/kody/servers'
import route60 from '~/chat/server/http/api/chat/kody/sync'
import route61 from '~/chat/server/http/api/chat/kody/unlink'
import route62 from '~/chat/server/http/api/chat/kody/usage'
import route64 from '~/chat/server/http/api/chat/mcp/contract'
import route67 from '~/chat/server/http/api/chat/openrouter/callback'
import route90 from '~/chat/server/http/api/chat/workspace-index.activity'
import route25 from '~/chat/server/http/api/chat/conversations/$id.execution.snapshots.$snapshotId'
import route20 from '~/chat/server/http/api/chat/conversations/$id/files/import'
import route7 from '~/chat/server/http/api/chat/bot-drafts/$id.files.$fileId.content'
import route12 from '~/chat/server/http/api/chat/bots/$id.files.$fileId.content'
import route26 from '~/chat/server/http/api/chat/conversations/$id.files.$fileId.content'
import route29 from '~/chat/server/http/api/chat/conversations/$id.workflow-runs.$runId.cancel'
import route8 from '~/chat/server/http/api/chat/bot-drafts/$id.files.$fileId'
import route13 from '~/chat/server/http/api/chat/bots/$id.files.$fileId'
import route27 from '~/chat/server/http/api/chat/conversations/$id.files.$fileId'
import route21 from '~/chat/server/http/api/chat/conversations/$id/memories/$memoryId'
import route30 from '~/chat/server/http/api/chat/conversations/$id.workflow-runs.$runId'
import route31 from '~/chat/server/http/api/chat/conversations/$id.workflows.$workflowId'
import route9 from '~/chat/server/http/api/chat/bot-drafts/$id.files'
import route14 from '~/chat/server/http/api/chat/bots/$id.files'
import route28 from '~/chat/server/http/api/chat/conversations/$id.files'
import route22 from '~/chat/server/http/api/chat/conversations/$id/memories'
import route23 from '~/chat/server/http/api/chat/conversations/$id/references'
import route71 from '~/chat/server/http/api/chat/project-snapshots.$hash.quarantine'
import route74 from '~/chat/server/http/api/chat/projects.$id.sync'
import route83 from '~/chat/server/http/api/chat/retries/$id.prepare'
import route11 from '~/chat/server/http/api/chat/bots/$id.$operation'
import route24 from '~/chat/server/http/api/chat/conversations/$id.$operation'
import route10 from '~/chat/server/http/api/chat/bot-drafts/$id'
import route15 from '~/chat/server/http/api/chat/bots/$id'
import route32 from '~/chat/server/http/api/chat/copies/$id'
import route68 from '~/chat/server/http/api/chat/plugins/$id'
import route72 from '~/chat/server/http/api/chat/project-snapshots.$hash'
import route75 from '~/chat/server/http/api/chat/projects.$id'
import route77 from '~/chat/server/http/api/chat/recipes/$id'
import route84 from '~/chat/server/http/api/chat/retries/$id'
import route85 from '~/chat/server/http/api/chat/sections/$id'
import route87 from '~/chat/server/http/api/chat/skills/$id'
import route92 from '~/chat/server/http/api/chat/workspace-sync/$operation'
import route63 from '~/chat/server/http/api/chat/mcp/$'
import route4 from '~/chat/server/http/api/chat/activity'
import route5 from '~/chat/server/http/api/chat/app-version'
import route6 from '~/chat/server/http/api/chat/bootstrap'
import route18 from '~/chat/server/http/api/chat/bots'
import route19 from '~/chat/server/http/api/chat/connection'
import route33 from '~/chat/server/http/api/chat/device-transport'
import route34 from '~/chat/server/http/api/chat/draft'
import route35 from '~/chat/server/http/api/chat/files'
import route65 from '~/chat/server/http/api/chat/model-options'
import route66 from '~/chat/server/http/api/chat/models'
import route69 from '~/chat/server/http/api/chat/plugins'
import route70 from '~/chat/server/http/api/chat/policy'
import route73 from '~/chat/server/http/api/chat/project-snapshots'
import route76 from '~/chat/server/http/api/chat/projects'
import route78 from '~/chat/server/http/api/chat/recipes'
import route82 from '~/chat/server/http/api/chat/references'
import route86 from '~/chat/server/http/api/chat/sections'
import route88 from '~/chat/server/http/api/chat/skills'
import route93 from '~/chat/server/http/api/chat/workspace'
import route89 from '~/chat/server/http/api/chat/workspace-history'
import route91 from '~/chat/server/http/api/chat/workspace-index'
import route94 from '~/chat/server/http/auth/mcp/callback'
import route95 from '~/chat/server/http/auth/mcp/client-metadata'

// Specific paths precede parameters and splats, matching the Start route tree.
export const chatHttpRoutes = [
  route48,
  route49,
  route43,
  route42,
  route44,
  route79,
  route80,
  route81,
  route41,
  route45,
  route46,
  route51,
  route53,
  route56,
  route57,
  route58,
  route0,
  route38,
  route47,
  route52,
  route54,
  route1,
  route2,
  route3,
  route16,
  route17,
  route36,
  route37,
  route39,
  route40,
  route50,
  route55,
  route59,
  route60,
  route61,
  route62,
  route64,
  route67,
  route90,
  route25,
  route20,
  route7,
  route12,
  route26,
  route29,
  route8,
  route13,
  route27,
  route21,
  route30,
  route31,
  route9,
  route14,
  route28,
  route22,
  route23,
  route71,
  route74,
  route83,
  route11,
  route24,
  route10,
  route15,
  route32,
  route68,
  route72,
  route75,
  route77,
  route84,
  route85,
  route87,
  route92,
  route63,
  route4,
  route5,
  route6,
  route18,
  route19,
  route33,
  route34,
  route35,
  route65,
  route66,
  route69,
  route70,
  route73,
  route76,
  route78,
  route82,
  route86,
  route88,
  route93,
  route89,
  route91,
  route94,
  route95,
]
