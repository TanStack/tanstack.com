import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import {
  onboardingInputSchema,
  onboardingSchema,
  type Onboarding,
} from '../core/onboarding'
import { hash } from './crypto'

export class OnboardingError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 409,
  ) {
    super(message)
    this.name = 'OnboardingError'
  }
}

type Row = {
  workspace_id: string | null
  workspace_name: string | null
  owner_id: string | null
  role: string | null
  revision: number | null
  status: Onboarding['status'] | null
  use_case: Onboarding['useCase']
  completed_at: number | null
}
type Receipt = { request_digest: string; result_json: string }

type Reader = Pick<typeof db, 'execute'>
export async function readOnboarding(
  userId: string,
  reader: Reader = db,
): Promise<Onboarding> {
  const [row] = await reader.execute<
    Row & Record<string, unknown>
  >(sql`SELECT w.id AS workspace_id,w.name AS workspace_name,w.owner_id,m.role,o.revision::float8 AS revision,o.status,o.use_case,o.completed_at::float8 AS completed_at
 FROM users u LEFT JOIN chat_workspaces w ON w.id='personal:'||u.id::text
 LEFT JOIN chat_memberships m ON m.workspace_id=w.id AND m.user_id=u.id
 LEFT JOIN chat_account_onboarding o ON o.user_id=u.id WHERE u.id=${userId}`)
  if (!row) throw new OnboardingError('Account not found.', 404)
  if (!row.workspace_id)
    throw new OnboardingError('Personal workspace not found.', 404)
  if (row.owner_id !== userId || row.role !== 'owner')
    throw new OnboardingError('Personal workspace access is unavailable.', 403)
  if (row.revision === null || row.status === null)
    throw new OnboardingError('Account setup is unavailable. Try again.', 404)
  return onboardingSchema.parse({
    revision: row.revision,
    status: row.status,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    useCase: row.use_case,
    completedAt: row.completed_at,
  })
}
async function readReceipt(reader: Reader, userId: string, commandId: string) {
  const [row] = await reader.execute<Receipt & Record<string, unknown>>(
    sql`SELECT request_digest,result_json FROM chat_account_onboarding_commands WHERE user_id=${userId} AND command_id=${commandId}`,
  )
  return row
}
function replay(receipt: Receipt, digest: string) {
  if (receipt.request_digest !== digest)
    throw new OnboardingError(
      'This setup command was already used. Reload before saving.',
      409,
    )
  return onboardingSchema.parse(JSON.parse(receipt.result_json))
}
function conflict() {
  return new OnboardingError(
    'Your setup changed. Reload it before saving.',
    409,
  )
}

export async function updateOnboarding(
  userId: string,
  input: unknown,
): Promise<Onboarding> {
  const value = onboardingInputSchema.parse(input)
  const digest = await hash(JSON.stringify(value))
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT o.user_id FROM chat_account_onboarding o JOIN chat_workspaces w ON w.id='personal:'||o.user_id::text JOIN chat_memberships m ON m.workspace_id=w.id AND m.user_id=o.user_id WHERE o.user_id=${userId} FOR UPDATE OF w,m,o`,
    )
    const current = await readOnboarding(userId, tx)
    const prior = await readReceipt(tx, userId, value.commandId)
    if (prior) return replay(prior, digest)
    if (
      value.revision !== current.revision ||
      current.revision === Number.MAX_SAFE_INTEGER
    )
      throw conflict()
    const next: Onboarding = {
      ...current,
      revision: current.revision + 1,
      status: value.action === 'save' ? 'completed' : 'skipped',
      workspaceName:
        value.action === 'save' ? value.workspaceName : current.workspaceName,
      useCase: value.action === 'save' ? value.useCase : current.useCase,
      completedAt: Date.now(),
    }
    const mutationId = crypto.randomUUID()
    await tx.execute(
      sql`INSERT INTO chat_account_onboarding_commands(user_id,command_id,request_digest,mutation_id,result_json) VALUES(${userId},${value.commandId},${digest},${mutationId},${JSON.stringify(next)})`,
    )
    await tx.execute(
      sql`UPDATE chat_account_onboarding SET revision=${next.revision},status=${next.status},use_case=${next.useCase},completed_at=${next.completedAt} WHERE user_id=${userId} AND revision=${value.revision}`,
    )
    await tx.execute(
      sql`UPDATE chat_workspaces SET name=${next.workspaceName} WHERE id=${current.workspaceId} AND owner_id=${userId}`,
    )
    await readOnboarding(userId, tx)
    const saved = await readReceipt(tx, userId, value.commandId)
    if (!saved) throw conflict()
    return replay(saved, digest)
  })
}
