import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { AuthUser } from '~/auth/types'
import type { Bootstrap } from '../components/App'
import type { KodyEnvironment } from './kody'
import type { McpEgressEnvironment } from './mcp-public-fetch'
import type { BrowserExecutionEnvironment } from './browser-execution'
import { readBootstrapWorkspaceData } from './bootstrap-workspace-data'
import { readOnboarding } from './onboarding'
import { readCredentials } from './credentials'
import { readKodyUsername } from './conversation-database'
import { readWorkspaceBot } from './bot-workspace-reads'
import {
  fundedSpendReport,
  fundedSpendPolicy,
  hasUnlimitedUsage,
} from './run-usage'
import { kodyNeedsSignIn } from './kody'
import { McpAccounts } from './mcp-accounts'
import { browserExecutionRequestAllowed } from './browser-execution'
import { localDevelopment } from './development'

export interface BootstrapEnvironment
  extends KodyEnvironment, McpEgressEnvironment, BrowserExecutionEnvironment {
  INCLUDED_MODEL: string
  UNLIMITED_USAGE_EMAILS?: string
}

/** Original bootstrap response fields, backed by shared account identity and native services. */
export async function readBootstrap(
  request: Request,
  env: BootstrapEnvironment,
  user: AuthUser,
  workspaceId: string,
): Promise<Bootstrap> {
  const data = await readBootstrapWorkspaceData(workspaceId, user.userId)
  const [onboarding, credentials, kodyLink, spend, usage, unlimited] =
    await Promise.all([
      readOnboarding(user.userId),
      readCredentials(env, user.userId),
      readKodyUsername(user.userId),
      fundedSpendReport(user.userId),
      db.execute<{ turns: number } & Record<string, unknown>>(
        sql`SELECT turns::float8 AS turns FROM chat_daily_usage WHERE user_id=${user.userId} AND day=${new Date().toISOString().slice(0, 10)}`,
      ),
      hasUnlimitedUsage(user.userId, env.UNLIMITED_USAGE_EMAILS),
    ])
  const assistantId = `assistant:${user.userId}`
  const personalAssistant =
    workspaceId === `personal:${user.userId}`
      ? data.bots.find((bot) => bot.id === assistantId)
      : await readWorkspaceBot(
          `personal:${user.userId}`,
          user.userId,
          assistantId,
        )
  const c = credentials?.connection
  return {
    ...data,
    user: {
      id: user.userId,
      username: user.displayUsername ?? user.name ?? user.email,
      email: user.email,
    },
    workspace: {
      id: data.workspace.id,
      name:
        data.workspace.id === onboarding.workspaceId
          ? onboarding.workspaceName
          : data.workspace.name,
    },
    onboarding,
    personalAssistant,
    fixture: false,
    browserExecution: browserExecutionRequestAllowed(request, env),
    kodyConnected: !!credentials?.kody,
    kodyNeedsSignIn: credentials?.kody
      ? await kodyNeedsSignIn(env, user.userId, credentials.kody)
      : false,
    kodyPrimary: false,
    kodyUsername: kodyLink?.username,
    connection: c
      ? { ...c, apiKey: undefined, hasKey: !!c.apiKey }
      : {
          provider: 'included',
          model: env.INCLUDED_MODEL,
          accountId: '',
          gatewayId: '',
          baseUrl: '',
          hasKey: false,
        },
    includedModel: env.INCLUDED_MODEL,
    connections: Object.fromEntries(
      Object.entries(credentials?.connections ?? {}).map(
        ([provider, saved]) => [
          provider,
          { ...saved, apiKey: undefined, hasKey: !!saved?.apiKey },
        ],
      ),
    ),
    mcpServers: data.policy.allowMcp
      ? await new McpAccounts(env, { workspaceId, userId: user.userId }).list()
      : [],
    usage: usage[0]?.turns ?? 0,
    dailyTurnLimit:
      localDevelopment() || unlimited ? null : data.policy.dailyTurns,
    fundedSpend: {
      estimatedUsd: spend.user_micros / 1_000_000,
      remainingUsd: Math.max(
        0,
        (fundedSpendPolicy.userCapMicros - spend.user_micros) / 1_000_000,
      ),
      dailyLimitUsd: fundedSpendPolicy.userCapMicros / 1_000_000,
      sharedEstimatedUsd: spend.global_micros / 1_000_000,
      sharedRemainingUsd: Math.max(
        0,
        (fundedSpendPolicy.globalCapMicros - spend.global_micros) / 1_000_000,
      ),
      sharedDailyLimitUsd: fundedSpendPolicy.globalCapMicros / 1_000_000,
      unknownRuns: spend.unknown_runs,
    },
  }
}
