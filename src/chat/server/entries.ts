import { DurableObject, WorkflowEntrypoint } from 'cloudflare:workers'
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers'
import type {
  WorkflowDriverEnvironment,
  WorkflowDriverParams,
} from './workflow-driver'
import type { Conversation as ConversationImplementation } from './conversation'
import type { WorkspaceSync as WorkspaceSyncImplementation } from './workspace-sync-object'
import type { StreamObject as StreamObjectImplementation } from '@durable-streams/server-cloudflare'

// Keep the deployed class names and storage namespaces, but initialize chat only
// when Cloudflare creates one of its objects. RPC methods stay on the prototype.
export class Conversation extends DurableObject<
  ConstructorParameters<typeof ConversationImplementation>[1]
> {
  private implementation!: ConversationImplementation
  constructor(
    ctx: ConstructorParameters<typeof ConversationImplementation>[0],
    env: ConstructorParameters<typeof ConversationImplementation>[1],
  ) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const { Conversation } = await import('./conversation')
      this.implementation = new Conversation(ctx, env)
    })
  }
  async alarm(...args: Parameters<ConversationImplementation['alarm']>) {
    return this.implementation.alarm(...args)
  }
  async copyBoundary(
    ...args: Parameters<ConversationImplementation['copyBoundary']>
  ) {
    return this.implementation.copyBoundary(...args)
  }
  async captureThreadSource(
    ...args: Parameters<ConversationImplementation['captureThreadSource']>
  ) {
    return this.implementation.captureThreadSource(...args)
  }
  async captureRetrySourceJson(
    ...args: Parameters<ConversationImplementation['captureRetrySourceJson']>
  ) {
    return this.implementation.captureRetrySourceJson(...args)
  }
  async captureRetrySource(
    ...args: Parameters<ConversationImplementation['captureRetrySource']>
  ) {
    return this.implementation.captureRetrySource(...args)
  }
  async actionEvidenceJson(
    ...args: Parameters<ConversationImplementation['actionEvidenceJson']>
  ) {
    return this.implementation.actionEvidenceJson(...args)
  }
  async retryPreparationSnapshot(
    ...args: Parameters<ConversationImplementation['retryPreparationSnapshot']>
  ) {
    return this.implementation.retryPreparationSnapshot(...args)
  }
  async startCopyExport(
    ...args: Parameters<ConversationImplementation['startCopyExport']>
  ) {
    return this.implementation.startCopyExport(...args)
  }
  async readCopyPage(
    ...args: Parameters<ConversationImplementation['readCopyPage']>
  ) {
    return this.implementation.readCopyPage(...args)
  }
  async readCopyPages(
    ...args: Parameters<ConversationImplementation['readCopyPages']>
  ) {
    return this.implementation.readCopyPages(...args)
  }
  async importCopyPage(
    ...args: Parameters<ConversationImplementation['importCopyPage']>
  ) {
    return this.implementation.importCopyPage(...args)
  }
  async importCopyPages(
    ...args: Parameters<ConversationImplementation['importCopyPages']>
  ) {
    return this.implementation.importCopyPages(...args)
  }
  async finishCopyImport(
    ...args: Parameters<ConversationImplementation['finishCopyImport']>
  ) {
    return this.implementation.finishCopyImport(...args)
  }
  async activateCopy(
    ...args: Parameters<ConversationImplementation['activateCopy']>
  ) {
    return this.implementation.activateCopy(...args)
  }
  async discardCopyImport(
    ...args: Parameters<ConversationImplementation['discardCopyImport']>
  ) {
    return this.implementation.discardCopyImport(...args)
  }
  async releaseCopyExport(
    ...args: Parameters<ConversationImplementation['releaseCopyExport']>
  ) {
    return this.implementation.releaseCopyExport(...args)
  }
  async wakeCopies(
    ...args: Parameters<ConversationImplementation['wakeCopies']>
  ) {
    return this.implementation.wakeCopies(...args)
  }
  async bindIdentity(
    ...args: Parameters<ConversationImplementation['bindIdentity']>
  ) {
    return this.implementation.bindIdentity(...args)
  }
  async lifecycleState(
    ...args: Parameters<ConversationImplementation['lifecycleState']>
  ) {
    return this.implementation.lifecycleState(...args)
  }
  async reserveEmptyThread(
    ...args: Parameters<ConversationImplementation['reserveEmptyThread']>
  ) {
    return this.implementation.reserveEmptyThread(...args)
  }
  async reserveDeletion(
    ...args: Parameters<ConversationImplementation['reserveDeletion']>
  ) {
    return this.implementation.reserveDeletion(...args)
  }
  async releaseDeletion(
    ...args: Parameters<ConversationImplementation['releaseDeletion']>
  ) {
    return this.implementation.releaseDeletion(...args)
  }
  async streamSnapshot(
    ...args: Parameters<ConversationImplementation['streamSnapshot']>
  ) {
    return this.implementation.streamSnapshot(...args)
  }
  async referenceContext(
    ...args: Parameters<ConversationImplementation['referenceContext']>
  ) {
    return this.implementation.referenceContext(...args)
  }
  async archivedMessage(
    ...args: Parameters<ConversationImplementation['archivedMessage']>
  ) {
    return this.implementation.archivedMessage(...args)
  }
  async archivedHistory(
    ...args: Parameters<ConversationImplementation['archivedHistory']>
  ) {
    return this.implementation.archivedHistory(...args)
  }
  async transcriptNavigation(
    ...args: Parameters<ConversationImplementation['transcriptNavigation']>
  ) {
    return this.implementation.transcriptNavigation(...args)
  }
  async readStream(
    ...args: Parameters<ConversationImplementation['readStream']>
  ) {
    return this.implementation.readStream(...args)
  }
  async snapshot(...args: Parameters<ConversationImplementation['snapshot']>) {
    return this.implementation.snapshot(...args)
  }
  async executionSnapshot(
    ...args: Parameters<ConversationImplementation['executionSnapshot']>
  ) {
    return this.implementation.executionSnapshot(...args)
  }
  async executionHistory(
    ...args: Parameters<ConversationImplementation['executionHistory']>
  ) {
    return this.implementation.executionHistory(...args)
  }
  async executionEvents(
    ...args: Parameters<ConversationImplementation['executionEvents']>
  ) {
    return this.implementation.executionEvents(...args)
  }
  async changeExecution(
    ...args: Parameters<ConversationImplementation['changeExecution']>
  ) {
    return this.implementation.changeExecution(...args)
  }
  async executionProjectSnapshot(
    ...args: Parameters<ConversationImplementation['executionProjectSnapshot']>
  ) {
    return this.implementation.executionProjectSnapshot(...args)
  }
  async reserveExecutionSnapshot(
    ...args: Parameters<ConversationImplementation['reserveExecutionSnapshot']>
  ) {
    return this.implementation.reserveExecutionSnapshot(...args)
  }
  async publishExecutionSnapshot(
    ...args: Parameters<ConversationImplementation['publishExecutionSnapshot']>
  ) {
    return this.implementation.publishExecutionSnapshot(...args)
  }
  async prepareDelegation(
    ...args: Parameters<ConversationImplementation['prepareDelegation']>
  ) {
    return this.implementation.prepareDelegation(...args)
  }
  async listWorkflowRuns(
    ...args: Parameters<ConversationImplementation['listWorkflowRuns']>
  ) {
    return this.implementation.listWorkflowRuns(...args)
  }
  async readWorkflowAnswer(
    ...args: Parameters<ConversationImplementation['readWorkflowAnswer']>
  ) {
    return this.implementation.readWorkflowAnswer(...args)
  }
  async readWorkflowOutputFile(
    ...args: Parameters<ConversationImplementation['readWorkflowOutputFile']>
  ) {
    return this.implementation.readWorkflowOutputFile(...args)
  }
  async readWorkflowFiles(
    ...args: Parameters<ConversationImplementation['readWorkflowFiles']>
  ) {
    return this.implementation.readWorkflowFiles(...args)
  }
  async inspectWorkflowRun(
    ...args: Parameters<ConversationImplementation['inspectWorkflowRun']>
  ) {
    return this.implementation.inspectWorkflowRun(...args)
  }
  async launchWorkflowRun(
    ...args: Parameters<ConversationImplementation['launchWorkflowRun']>
  ) {
    return this.implementation.launchWorkflowRun(...args)
  }
  async withdrawWorkflowStart(
    ...args: Parameters<ConversationImplementation['withdrawWorkflowStart']>
  ) {
    return this.implementation.withdrawWorkflowStart(...args)
  }
  async startWorkflowRun(
    ...args: Parameters<ConversationImplementation['startWorkflowRun']>
  ) {
    return this.implementation.startWorkflowRun(...args)
  }
  async advanceWorkflowRun(
    ...args: Parameters<ConversationImplementation['advanceWorkflowRun']>
  ) {
    return this.implementation.advanceWorkflowRun(...args)
  }
  async cancelWorkflowRun(
    ...args: Parameters<ConversationImplementation['cancelWorkflowRun']>
  ) {
    return this.implementation.cancelWorkflowRun(...args)
  }
  async settleWorkflowStep(
    ...args: Parameters<ConversationImplementation['settleWorkflowStep']>
  ) {
    return this.implementation.settleWorkflowStep(...args)
  }
  async workflowGrant(
    ...args: Parameters<ConversationImplementation['workflowGrant']>
  ) {
    return this.implementation.workflowGrant(...args)
  }
  async workflowInputs(
    ...args: Parameters<ConversationImplementation['workflowInputs']>
  ) {
    return this.implementation.workflowInputs(...args)
  }
  async workflowFileInput(
    ...args: Parameters<ConversationImplementation['workflowFileInput']>
  ) {
    return this.implementation.workflowFileInput(...args)
  }
  async reserveWorkflowOperation(
    ...args: Parameters<ConversationImplementation['reserveWorkflowOperation']>
  ) {
    return this.implementation.reserveWorkflowOperation(...args)
  }
  async delegationGrant(
    ...args: Parameters<ConversationImplementation['delegationGrant']>
  ) {
    return this.implementation.delegationGrant(...args)
  }
  async reserveDelegationOperation(
    ...args: Parameters<
      ConversationImplementation['reserveDelegationOperation']
    >
  ) {
    return this.implementation.reserveDelegationOperation(...args)
  }
  async admitWorkflowRun(
    ...args: Parameters<ConversationImplementation['admitWorkflowRun']>
  ) {
    return this.implementation.admitWorkflowRun(...args)
  }
  async admitDelegatedRun(
    ...args: Parameters<ConversationImplementation['admitDelegatedRun']>
  ) {
    return this.implementation.admitDelegatedRun(...args)
  }
  async revokeDelegatedRun(
    ...args: Parameters<ConversationImplementation['revokeDelegatedRun']>
  ) {
    return this.implementation.revokeDelegatedRun(...args)
  }
  async delegatedRunReport(
    ...args: Parameters<ConversationImplementation['delegatedRunReport']>
  ) {
    return this.implementation.delegatedRunReport(...args)
  }
  async revokeWorkflowRun(
    ...args: Parameters<ConversationImplementation['revokeWorkflowRun']>
  ) {
    return this.implementation.revokeWorkflowRun(...args)
  }
  async workflowStepUsage(
    ...args: Parameters<ConversationImplementation['workflowStepUsage']>
  ) {
    return this.implementation.workflowStepUsage(...args)
  }
  async workflowRunResult(
    ...args: Parameters<ConversationImplementation['workflowRunResult']>
  ) {
    return this.implementation.workflowRunResult(...args)
  }
  async delegationSnapshot(
    ...args: Parameters<ConversationImplementation['delegationSnapshot']>
  ) {
    return this.implementation.delegationSnapshot(...args)
  }
  async delegationHistory(
    ...args: Parameters<ConversationImplementation['delegationHistory']>
  ) {
    return this.implementation.delegationHistory(...args)
  }
  async taskDelegations(
    ...args: Parameters<ConversationImplementation['taskDelegations']>
  ) {
    return this.implementation.taskDelegations(...args)
  }
  async taskUsage(
    ...args: Parameters<ConversationImplementation['taskUsage']>
  ) {
    return this.implementation.taskUsage(...args)
  }
  async historicalTaskUsage(
    ...args: Parameters<ConversationImplementation['historicalTaskUsage']>
  ) {
    return this.implementation.historicalTaskUsage(...args)
  }
  async cancelDelegatedTask(
    ...args: Parameters<ConversationImplementation['cancelDelegatedTask']>
  ) {
    return this.implementation.cancelDelegatedTask(...args)
  }
  async waitForDelegatedTasks(
    ...args: Parameters<ConversationImplementation['waitForDelegatedTasks']>
  ) {
    return this.implementation.waitForDelegatedTasks(...args)
  }
  async scheduleSnapshot(
    ...args: Parameters<ConversationImplementation['scheduleSnapshot']>
  ) {
    return this.implementation.scheduleSnapshot(...args)
  }
  async changeSchedule(
    ...args: Parameters<ConversationImplementation['changeSchedule']>
  ) {
    return this.implementation.changeSchedule(...args)
  }
  async runHistory(
    ...args: Parameters<ConversationImplementation['runHistory']>
  ) {
    return this.implementation.runHistory(...args)
  }
  async stop(...args: Parameters<ConversationImplementation['stop']>) {
    return this.implementation.stop(...args)
  }
  async dismissPendingTask(
    ...args: Parameters<ConversationImplementation['dismissPendingTask']>
  ) {
    return this.implementation.dismissPendingTask(...args)
  }
  async reset(...args: Parameters<ConversationImplementation['reset']>) {
    return this.implementation.reset(...args)
  }
  async begin(...args: Parameters<ConversationImplementation['begin']>) {
    return this.implementation.begin(...args)
  }
  async sendReceipt(
    ...args: Parameters<ConversationImplementation['sendReceipt']>
  ) {
    return this.implementation.sendReceipt(...args)
  }
  async updateQueue(
    ...args: Parameters<ConversationImplementation['updateQueue']>
  ) {
    return this.implementation.updateQueue(...args)
  }
  async decideApproval(
    ...args: Parameters<ConversationImplementation['decideApproval']>
  ) {
    return this.implementation.decideApproval(...args)
  }
  async continueTask(
    ...args: Parameters<ConversationImplementation['continueTask']>
  ) {
    return this.implementation.continueTask(...args)
  }
}
export class WorkspaceSync extends DurableObject<
  ConstructorParameters<typeof WorkspaceSyncImplementation>[1]
> {
  private implementation!: WorkspaceSyncImplementation
  constructor(
    ctx: ConstructorParameters<typeof WorkspaceSyncImplementation>[0],
    env: ConstructorParameters<typeof WorkspaceSyncImplementation>[1],
  ) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const { WorkspaceSync } = await import('./workspace-sync-object')
      this.implementation = new WorkspaceSync(ctx, env)
    })
  }
  async snapshot(...args: Parameters<WorkspaceSyncImplementation['snapshot']>) {
    return this.implementation.snapshot(...args)
  }
  async publish(...args: Parameters<WorkspaceSyncImplementation['publish']>) {
    return this.implementation.publish(...args)
  }
  async read(...args: Parameters<WorkspaceSyncImplementation['read']>) {
    return this.implementation.read(...args)
  }
  async alarm(...args: Parameters<WorkspaceSyncImplementation['alarm']>) {
    return this.implementation.alarm(...args)
  }
}
export class StreamObject extends DurableObject<
  ConstructorParameters<typeof StreamObjectImplementation>[1]
> {
  private implementation!: StreamObjectImplementation
  constructor(
    ctx: ConstructorParameters<typeof StreamObjectImplementation>[0],
    env: ConstructorParameters<typeof StreamObjectImplementation>[1],
  ) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const { StreamObject } =
        await import('@durable-streams/server-cloudflare')
      this.implementation = new StreamObject(ctx, env)
    })
  }
  async fetch(...args: Parameters<StreamObjectImplementation['fetch']>) {
    return this.implementation.fetch(...args)
  }
  async alarm(...args: Parameters<StreamObjectImplementation['alarm']>) {
    return this.implementation.alarm(...args)
  }
  async forkAcquire(
    ...args: Parameters<StreamObjectImplementation['forkAcquire']>
  ) {
    return this.implementation.forkAcquire(...args)
  }
  async forkRelease(
    ...args: Parameters<StreamObjectImplementation['forkRelease']>
  ) {
    return this.implementation.forkRelease(...args)
  }
  async readRange(
    ...args: Parameters<StreamObjectImplementation['readRange']>
  ) {
    return this.implementation.readRange(...args)
  }
}
export class TanChatWorkflow extends WorkflowEntrypoint<
  WorkflowDriverEnvironment,
  WorkflowDriverParams
> {
  async run(event: WorkflowEvent<WorkflowDriverParams>, step: WorkflowStep) {
    const { TanChatWorkflow } = await import('./workflow-driver')
    return new TanChatWorkflow(this.ctx, this.env).run(event, step)
  }
}
