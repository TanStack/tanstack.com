import type { SqlStorage } from '@cloudflare/workers-types'
/** Owner-local outbox. Enqueue with the start receipt and alarm transaction. */
export class WorkflowLaunches {
  constructor(private sql: SqlStorage) {
    sql.exec(`CREATE TABLE IF NOT EXISTS workflow_launches (
      run_id TEXT PRIMARY KEY, instance_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL, attempt INTEGER NOT NULL, due_at INTEGER NOT NULL)`)
  }
  get(id: string) {
    return this.sql
      .exec<{
        run_id: string
        instance_id: string
        state: string
        attempt: number
        due_at: number
      }>('SELECT * FROM workflow_launches WHERE run_id=?', id)
      .toArray()[0]
  }
  enqueue(id: string, instanceId: string, now: number) {
    const old = this.get(id)
    if (old) {
      if (old.instance_id !== instanceId)
        throw Error('Workflow launch identity changed.')
      return old
    }
    this.sql.exec(
      'INSERT INTO workflow_launches VALUES(?,?,?,0,?)',
      id,
      instanceId,
      'pending',
      now,
    )
    return this.get(id)!
  }
  finish(id: string, state: 'delivered' | 'cancelled') {
    this.sql.exec(
      'UPDATE workflow_launches SET state=? WHERE run_id=? AND state=?',
      state,
      id,
      'pending',
    )
  }
  retry(id: string, now: number) {
    const old = this.get(id)
    if (!old || old.state !== 'pending') return
    const attempt = Math.min(6, old.attempt + 1)
    this.sql.exec(
      'UPDATE workflow_launches SET attempt=?,due_at=? WHERE run_id=? AND state=?',
      attempt,
      now + Math.min(60000, 1000 * 2 ** attempt),
      id,
      'pending',
    )
  }
  due(now: number) {
    return this.sql
      .exec<{ run_id: string }>(
        'SELECT run_id FROM workflow_launches WHERE state=? AND due_at<=? ORDER BY due_at,run_id LIMIT 4',
        'pending',
        now,
      )
      .toArray()
  }
  nextWake() {
    return (
      this.sql
        .exec<{ due: number | null }>(
          'SELECT MIN(due_at) AS due FROM workflow_launches WHERE state=?',
          'pending',
        )
        .toArray()[0]?.due ?? undefined
    )
  }
}
