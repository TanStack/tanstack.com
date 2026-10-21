import type { WorkspaceSyncSnapshot } from '../core/workspace-sync'
import { DurableObject } from 'cloudflare:workers'
import {
  WorkspaceSyncPublisher,
  type WorkspaceSyncEnvironment,
} from './workspace-sync'
import { runWithDatabaseContext } from '~/db/client'
import {
  runWithHostRuntimeContext,
  runWithHostRuntimeEnv,
} from '~/server/runtime/host.server'
import type { DurableObjectState } from '@cloudflare/workers-types'

export class WorkspaceSync extends DurableObject<WorkspaceSyncEnvironment> {
  private publisher: WorkspaceSyncPublisher
  constructor(ctx: DurableObjectState, env: WorkspaceSyncEnvironment) {
    super(ctx, env)
    this.publisher = new WorkspaceSyncPublisher(ctx, env)
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    return runWithHostRuntimeEnv(this.env, () =>
      runWithHostRuntimeContext(this.ctx, () => runWithDatabaseContext(work)),
    )
  }
  snapshot(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceSyncSnapshot | undefined> {
    return this.run(() => this.publisher.snapshot(workspaceId, userId))
  }
  publish(workspaceId: string) {
    return this.run(() => this.publisher.publish(workspaceId))
  }
  read(workspaceId: string, userId: string, generation: string, query: string) {
    return this.run(() =>
      this.publisher.read(workspaceId, userId, generation, query),
    )
  }
  alarm() {
    return this.run(() => this.publisher.alarm())
  }
}
