import type { SqlStorage } from '@cloudflare/workers-types'
import { workflowRunListSchema } from '../core/workflow-inspection'
import { workflowStartSchema } from '../core/workflow-start'
import { z } from 'zod'
import { canonicalCopyJson } from '../core/conversation-copy'
import { workflowStepAdmissionSchema } from '../core/workflow-admission'
import {
  workflowOperationSchema,
  type WorkflowOperation,
} from '../core/workflow-operation'
import {
  workflowRunRequestSchema,
  workflowStepResultSchema,
  readyWorkflowSteps,
  workflowRunStatus,
  type WorkflowRun,
  type WorkflowRunRequest,
  type WorkflowStepResult,
} from '../core/workflow-runs'

/** Internal journal only. The host must authorize every operation and commit an
 * admission with its child dispatch record before performing any external work. */
export class WorkflowRuns {
  constructor(private sql: SqlStorage) {
    sql.exec(
      'CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,trigger_key TEXT UNIQUE NOT NULL,json TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS workflow_starts(command_id TEXT PRIMARY KEY, command_json TEXT NOT NULL, run_id TEXT NOT NULL)',
    )
    sql.exec(
      'CREATE TABLE IF NOT EXISTS workflow_start_withdrawals(command_id TEXT PRIMARY KEY, command_json TEXT NOT NULL)',
    )
  }
  list(raw: unknown = {}) {
    const query = workflowRunListSchema.parse(raw)
    const time = "json_extract(json,'$.request.createdAt')"
    const rows = this.sql
      .exec<{ json: string }>(
        `SELECT json FROM workflow_runs
      ${query.after ? `WHERE (${time}<? OR (${time}=? AND id<?))` : ''}
      ORDER BY ${time} DESC,id DESC LIMIT ?`,
        ...(query.after
          ? [query.after.createdAt, query.after.createdAt, query.after.id]
          : []),
        query.limit + 1,
      )
      .toArray()
    const items = rows
      .slice(0, query.limit)
      .map((row) => JSON.parse(row.json) as WorkflowRun)
    const last = items.at(-1)
    return {
      items,
      ...(rows.length > query.limit && last
        ? {
            nextAfter: {
              createdAt: last.request.createdAt,
              id: last.request.id,
            },
          }
        : {}),
    }
  }
  get(id: string): WorkflowRun | undefined {
    const row = this.sql
      .exec<{ json: string }>('SELECT json FROM workflow_runs WHERE id=?', id)
      .toArray()[0]
    return row ? JSON.parse(row.json) : undefined
  }
  started(raw: unknown) {
    const command = workflowStartSchema.parse(raw)
    if (this.withdrawn(command))
      throw Error('This workflow start request was withdrawn.')
    const row = this.sql
      .exec<{ command_json: string; run_id: string }>(
        'SELECT command_json,run_id FROM workflow_starts WHERE command_id=?',
        command.commandId,
      )
      .toArray()[0]
    if (!row) return
    if (row.command_json !== canonicalCopyJson(command))
      throw Error('This workflow start command belongs to different input.')
    const run = this.get(row.run_id)
    if (!run) throw Error('Workflow start receipt is missing its run.')
    return run
  }
  private withdrawn(raw: unknown) {
    const command = workflowStartSchema.parse(raw)
    const row = this.sql
      .exec<{ command_json: string }>(
        'SELECT command_json FROM workflow_start_withdrawals WHERE command_id=?',
        command.commandId,
      )
      .toArray()[0]
    if (row && row.command_json !== canonicalCopyJson(command))
      throw Error('This workflow start command belongs to different input.')
    return !!row
  }
  /** Caller authorizes the owner and commits synchronously in owner storage.
   * An admitted run wins; otherwise the tombstone fences delayed start calls. */
  withdrawStart(raw: unknown) {
    const command = workflowStartSchema.parse(raw)
    if (this.withdrawn(command)) return { status: 'withdrawn' as const }
    const run = this.started(command)
    if (run) return { status: 'admitted' as const, runId: run.request.id }
    this.sql.exec(
      'INSERT INTO workflow_start_withdrawals VALUES(?,?)',
      command.commandId,
      canonicalCopyJson(command),
    )
    return { status: 'withdrawn' as const }
  }
  /** Caller commits this synchronously in its owner storage transaction. */
  start(raw: unknown, request: WorkflowRunRequest) {
    const command = workflowStartSchema.parse(raw)
    const previous = this.started(command)
    if (previous) return previous
    if (
      request.id !== command.commandId ||
      request.workflowId !== command.workflowId ||
      request.definitionRevision !== command.revision
    )
      throw Error('Workflow start does not match its request.')
    const run = this.create(request)
    this.sql.exec(
      'INSERT INTO workflow_starts VALUES(?,?,?)',
      command.commandId,
      canonicalCopyJson(command),
      run.request.id,
    )
    return run
  }
  create(raw: WorkflowRunRequest) {
    const request = workflowRunRequestSchema.parse(raw)
    const key = canonicalCopyJson([
      request.scope,
      request.workflowId,
      request.triggerId,
    ])
    const found = this.sql
      .exec<{ json: string }>(
        'SELECT json FROM workflow_runs WHERE id=? OR trigger_key=?',
        request.id,
        key,
      )
      .toArray()
    if (found.length) {
      if (found.length !== 1) throw Error('Conflicting workflow run identity.')
      const previous = JSON.parse(found[0].json) as WorkflowRun
      if (canonicalCopyJson(previous.request) !== canonicalCopyJson(request))
        throw Error(
          'Workflow trigger already belongs to a different run request.',
        )
      return previous
    }
    const run: WorkflowRun = {
      request,
      operations: [],
      steps: request.definition.steps.map((step) => ({
        id: step.id,
        status: 'pending',
      })),
      updatedAt: request.createdAt,
    }
    this.sql.exec(
      'INSERT INTO workflow_runs VALUES(?,?,?)',
      request.id,
      key,
      JSON.stringify(run),
    )
    return run
  }
  private require(id: string, now: number) {
    z.number().int().nonnegative().safe().parse(now)
    const run = this.get(id)
    if (!run) throw Error('Workflow run not found.')
    if (now < run.updatedAt) throw Error('Workflow time cannot move backwards.')
    return run
  }
  private save(run: WorkflowRun, now: number) {
    run.updatedAt = now
    this.sql.exec(
      'UPDATE workflow_runs SET json=? WHERE id=?',
      JSON.stringify(run),
      run.request.id,
    )
    return run
  }
  /** Verifies workflow liveness only. The host also checks current user access,
   * policy, payer and capability permissions before each operation. */
  activeAdmission(raw: unknown, now: number) {
    const admission = workflowStepAdmissionSchema.parse(raw)
    const run = this.require(admission.workflowRunId, now)
    const step = run.steps.find((item) => item.id === admission.stepId)
    if (
      !step?.admission ||
      step.executionId !== admission.id ||
      canonicalCopyJson(step.admission) !== canonicalCopyJson(admission)
    )
      throw Error('Workflow admission does not match its recorded dispatch.')
    if (now >= run.request.deadline) throw Error('Workflow deadline reached.')
    if (workflowRunStatus(run) !== 'running' || step.status !== 'dispatched')
      throw Error('Workflow execution is no longer active.')
    return admission
  }
  /** Reserve before effects. Exact replay accounts once, but is not permission
   * to repeat an effect. Never refund operations with an uncertain outcome. */
  reserve(rawAdmission: unknown, rawOperation: WorkflowOperation, now: number) {
    const admission = this.activeAdmission(rawAdmission, now)
    const operation = workflowOperationSchema.parse(rawOperation)
    if (operation.executionId !== admission.id)
      throw Error('Workflow operation belongs to another execution.')
    const run = this.require(admission.workflowRunId, now)
    const previous = run.operations.find(
      (item) => item.operation.id === operation.id,
    )
    if (previous) {
      if (
        canonicalCopyJson(previous.operation) !== canonicalCopyJson(operation)
      )
        throw Error('Workflow operation ID belongs to a different request.')
      return previous
    }
    if (
      run.operations.filter((item) => item.operation.kind === operation.kind)
        .length >= run.request.operationLimits[operation.kind]
    )
      throw Error(`Workflow reached its shared ${operation.kind} limit.`)
    const receipt = { operation, reservedAt: now }
    run.operations.push(receipt)
    this.save(run, now)
    return receipt
  }
  claim(id: string, stepId: string, executionId: string, now: number) {
    z.uuid().parse(executionId)
    const run = this.require(id, now)
    const step = run.steps.find((step) => step.id === stepId)
    if (!step) throw Error('Workflow step not found.')
    if (step.executionId === executionId) return run
    if (now >= run.request.deadline) throw Error('Workflow deadline reached.')
    if (run.steps.some((step) => step.executionId === executionId))
      throw Error('Execution already belongs to another step.')
    if (!readyWorkflowSteps(run).includes(stepId))
      throw Error('Workflow step is not ready.')
    // Pin only explicitly selected outputs, never the whole predecessor context.
    // Resolve all references before mutating the admission, so an incomplete
    // result receipt cannot leave a partially claimed step.
    const definition = run.request.definition.steps.find(
      (item) => item.id === stepId,
    )!
    const inputs = definition.inputs.map((input) => {
      const predecessor = run.steps.find((item) => item.id === input.fromStep)
      if (
        predecessor?.status !== 'completed' ||
        !predecessor.executionId ||
        predecessor.result?.status !== 'completed'
      )
        throw Error('Workflow input has no completed execution receipt.')
      return {
        ...input,
        executionId: predecessor.executionId,
        resultId: predecessor.result.resultId,
      }
    })
    const admission = workflowStepAdmissionSchema.parse({
      id: executionId,
      workflowRunId: run.request.id,
      workflowId: run.request.workflowId,
      definitionRevision: run.request.definitionRevision,
      stepId,
      owner: run.request.scope,
      childConversationId: executionId,
      objective: definition.objective,
      model: run.request.model,
      sources: run.request.sources,
      inputs,
      createdAt: now,
      deadline: run.request.deadline,
    })
    step.executionId = executionId
    step.inputs = inputs
    step.admission = admission
    step.status = 'dispatched'
    return this.save(run, now)
  }
  settle(
    id: string,
    stepId: string,
    executionId: string,
    raw: WorkflowStepResult,
    now: number,
  ) {
    const result = workflowStepResultSchema.parse(raw)
    const run = this.require(id, now)
    const step = run.steps.find((step) => step.id === stepId)
    if (!step || step.executionId !== executionId)
      throw Error('Workflow execution does not match this step.')
    if (step.result) {
      if (canonicalCopyJson(step.result) !== canonicalCopyJson(result))
        throw Error('Workflow result is already recorded.')
      return run
    }
    if (step.status !== 'dispatched')
      throw Error('Workflow step was not dispatched.')
    step.status = result.status
    step.result = result
    if (result.status !== 'completed')
      for (const pending of run.steps)
        if (pending.status === 'pending') pending.status = 'cancelled'
    return this.save(run, now)
  }
  cancel(id: string, reason: 'user' | 'deadline', now: number) {
    z.enum(['user', 'deadline']).parse(reason)
    const run = this.require(id, now)
    if (['completed', 'failed', 'cancelled'].includes(workflowRunStatus(run)))
      return run
    if (reason === 'deadline' && now < run.request.deadline)
      throw Error('Workflow deadline has not been reached.')
    run.cancelReason ??= reason
    for (const step of run.steps)
      if (step.status === 'pending') step.status = 'cancelled'
    // Dispatched work stays outstanding until its exact child acknowledges.
    return this.save(run, now)
  }
}
