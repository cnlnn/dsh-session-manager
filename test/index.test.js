import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { SessionTrashManager } from '../index.js'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture({ live = false, running = false, archived = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-session-manager-'))
  roots.push(root)
  const id = 'session-11111111-1111-4111-8111-111111111111'
  const cwd = join(root, 'workspace')
  const sessionDirectory = join(root, 'sessions', 'workspace-key', id)
  const artifact = join(sessionDirectory, 'session.jsonl.zstd')
  const trashDirectory = join(root, 'trash')
  await mkdir(sessionDirectory, { recursive: true })
  await mkdir(cwd)
  await writeFile(artifact, 'durable session bytes')
  const meta = {
    id,
    version: 0,
    cwd,
    createdAt: Date.parse('2026-08-28T10:00:00.000Z'),
  }
  let disposed = false
  let projectionDeleted = false
  const workspaceId = 'workspace-1'
  const workspaceSessions = [id]
  const liveSessions = new Map(live ? [[id, { id }]] : [])
  const persistence = {
    locate: header => ({ kind: 'jsonl', path: join(root, 'sessions', 'workspace-key', header.id, 'session.jsonl.zstd') }),
    list: async () => {
      try {
        await stat(artifact)
        return [meta]
      } catch {
        return []
      }
    },
    prepare: async () => ({
      session: { header: meta },
      [Symbol.dispose]() { disposed = true },
    }),
  }
  const workspace = {
    id: workspaceId,
    get sessionIds() { return [...workspaceSessions] },
    async detachSession(sessionId) {
      const at = workspaceSessions.indexOf(sessionId)
      if (at !== -1) workspaceSessions.splice(at, 1)
    },
    async attachSession(sessionId) {
      if (!workspaceSessions.includes(sessionId)) workspaceSessions.push(sessionId)
    },
  }
  const registry = {
    state: { archivedSessionIds: archived ? [id] : [] },
    list: () => [workspace],
    get: value => value === workspaceId ? workspace : undefined,
    get archivedSessionIds() { return this.state.archivedSessionIds },
    async setState(value) { this.state = value },
    async archiveSession(sessionId) {
      if (!this.state.archivedSessionIds.includes(sessionId)) {
        this.state = { ...this.state, archivedSessionIds: [...this.state.archivedSessionIds, sessionId] }
      }
    },
    headers: new Map([[id, meta]]),
    sessionPaths: new Map([[id, cwd]]),
    invalidSessionPaths: new Map(),
  }
  const projectionCache = {
    cachedSnapshot: () => ({ values: { title: 'Release validation' } }),
    table: { async delete() { projectionDeleted = true } },
  }
  const ctx = {
    sessionPersistence: persistence,
    sessions: { get: sessionId => liveSessions.get(sessionId) },
    get: service => service === 'agents'
      ? { get: sessionId => sessionId === id && running ? { status: 'running' } : undefined }
      : service === 'sessionProjectionCache'
      ? projectionCache
      : service === 'workspaceRegistry' ? registry : undefined,
  }
  return {
    root,
    id,
    artifact,
    sessionDirectory,
    trashDirectory,
    manager: new SessionTrashManager(ctx, { trashDirectory }),
    disposed: () => disposed,
    projectionDeleted: () => projectionDeleted,
    workspaceSessions,
    registry,
  }
}

test('moves a cold persisted session to trash and restores it', async () => {
  const f = await fixture({ archived: true })

  const moved = await f.manager.trash(f.id)
  await assert.rejects(stat(f.sessionDirectory), /ENOENT/)
  assert.equal((await f.manager.list()).sessions.length, 0)
  const trashed = (await f.manager.list()).trash
  assert.equal(trashed.length, 1)
  assert.equal(trashed[0].title, 'Release validation')
  assert.equal(f.disposed(), false)
  assert.deepEqual(f.workspaceSessions, [])
  assert.deepEqual(f.registry.archivedSessionIds, [])
  assert.equal(f.projectionDeleted(), true)

  await f.manager.restore(moved.trashId)
  assert.equal(await readFile(f.artifact, 'utf8'), 'durable session bytes')
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), true)
  assert.deepEqual(f.workspaceSessions, [f.id])
  assert.deepEqual(f.registry.archivedSessionIds, [f.id])
})

test('refuses to move a live session', async () => {
  const f = await fixture({ live: true })
  await assert.rejects(f.manager.trash(f.id), /已打开的会话不能删除/)
  assert.equal(await readFile(f.artifact, 'utf8'), 'durable session bytes')
})

test('reports running separately from an attached idle session', async () => {
  const idle = await fixture({ live: true })
  const idleRow = (await idle.manager.list()).sessions[0]
  assert.equal(idleRow.attached, true)
  assert.equal(idleRow.running, false)

  const active = await fixture({ live: true, running: true })
  const activeRow = (await active.manager.list()).sessions[0]
  assert.equal(activeRow.attached, true)
  assert.equal(activeRow.running, true)
  await assert.rejects(active.manager.trash(active.id), /运行中的会话不能删除/)
})

test('permanently removes a trashed payload', async () => {
  const f = await fixture()
  const moved = await f.manager.trash(f.id)

  await f.manager.purge(moved.trashId)
  assert.equal((await f.manager.list()).trash.length, 0)
  await assert.rejects(stat(f.artifact), /ENOENT/)
})
