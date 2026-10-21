import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { inject, moveDirectory, SessionTrashManager } from '../index.js'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture({ live = false, running = false, archived = false, blank = false, predecessorTitle = false } = {}) {
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
  let projectionRebuilt = false
  const workspaceId = 'workspace-1'
  const workspaceSessions = [id]
  const liveSessions = new Map(live ? [[id, { id }]] : [])
  let agentAttached = live
  const closeLifecycle = async () => {
    agentAttached = false
    liveSessions.delete(id)
  }
  closeLifecycle[Context.effect] = { label: `agentLoop.lifecycle(${id})`, children: [] }
  const apiProxy = { ctx: { fiber: { _disposables: new Set([closeLifecycle]) } } }
  const known = new Map([[id, meta]])
  const persistence = {
    locate: header => ({ kind: 'jsonl', path: join(root, 'sessions', 'workspace-key', header.id, 'session.jsonl.zstd') }),
    list: async () => {
      const present = []
      for (const header of known.values()) {
        try {
          await stat(join(root, 'sessions', 'workspace-key', header.id, 'session.jsonl.zstd'))
          present.push(header)
        } catch {
          // A removed session drops out of the inventory.
        }
      }
      return present
    },
    prepare: async requested => ({
      session: { header: known.get(requested) ?? meta },
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
    cachedSnapshot: () => predecessorTitle ? undefined : ({ values: { title: 'Release validation', sessionListMetadata: { blank } } }),
    cachedPredecessorTitle: () => predecessorTitle ? { values: { title: 'Recovered predecessor title' } } : undefined,
    async coldSnapshot() { projectionRebuilt = true },
    table: { async delete() { projectionDeleted = true } },
  }
  const ctx = {
    sessionPersistence: persistence,
    sessions: { get: sessionId => liveSessions.get(sessionId) },
    get: service => service === 'agents'
      ? { get: sessionId => sessionId === id && agentAttached ? { status: running ? 'running' : 'idle' } : undefined }
      : service === 'apiProxy' ? apiProxy
      : service === 'sessionProjectionCache'
      ? projectionCache
      : service === 'workspaceRegistry' ? registry : undefined,
  }
  let showSidebarTrash = true
  const managerConfig = {
    trashDirectory,
    get showSidebarTrash() { return showSidebarTrash },
  }
  return {
    root,
    id,
    artifact,
    sessionDirectory,
    trashDirectory,
    manager: new SessionTrashManager(ctx, managerConfig),
    setShowSidebarTrash(value) { showSidebarTrash = value },
    disposed: () => disposed,
    projectionDeleted: () => projectionDeleted,
    projectionRebuilt: () => projectionRebuilt,
    workspaceSessions,
    registry,
    persistence,
    async addSession(extraId) {
      const sessionDirectory = join(root, 'sessions', 'workspace-key', extraId)
      await mkdir(sessionDirectory, { recursive: true })
      await writeFile(join(sessionDirectory, 'session.jsonl.zstd'), 'extra session bytes')
      known.set(extraId, {
        id: extraId,
        version: 0,
        cwd,
        createdAt: Date.parse('2026-08-28T11:00:00.000Z'),
      })
      return extraId
    },
  }
}

test('removes a session whose log cannot be migrated', async () => {
  const blocked = new Error('subagent/descriptor 6 uses unsupported descriptor version 2; source v0 artifact remains unchanged')
  blocked.name = 'SessionFormatUnsupportedError'
  const deleted = await fixture()
  deleted.persistence.prepare = async () => { throw blocked }
  assert.equal((await deleted.manager.deleteForever(deleted.id)).sessionId, deleted.id)
  await assert.rejects(stat(deleted.artifact), /ENOENT/)

  const moved = await fixture()
  moved.persistence.prepare = async () => { throw blocked }
  const entry = await moved.manager.trash(moved.id)
  await assert.rejects(stat(moved.artifact), /ENOENT/)
  assert.equal((await moved.manager.list()).trash.length, 1)
  await moved.manager.restore(entry.trashId)
  assert.equal(await readFile(moved.artifact, 'utf8'), 'durable session bytes')

  const locked = await fixture({ live: true, running: true })
  await assert.rejects(locked.manager.deleteForever(locked.id), /运行中的会话不能永久删除/)
  assert.equal(await readFile(locked.artifact, 'utf8'), 'durable session bytes')
})

test('applies a batch and keeps going when one session cannot be moved', async () => {
  const f = await fixture({ live: true, running: true })
  const extra = await f.addSession('session-22222222-2222-4222-8222-222222222222')

  const result = await f.manager.applyBatch('trash', [f.id, extra, extra])
  assert.equal(result.succeeded, 1)
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].id, f.id)
  assert.match(result.failed[0].error, /运行中的会话不能删除/)
  assert.equal((await f.manager.list()).sessions.map(item => item.id).join(','), f.id)
  assert.equal((await f.manager.list()).trash.length, 1)

  await assert.rejects(f.manager.applyBatch('trash', []), /ids must contain/)
  await assert.rejects(f.manager.applyBatch('rename', [extra]), /unknown batch operation/)
})

test('lists a predecessor title when the current projection snapshot is unavailable', async () => {
  const f = await fixture({ predecessorTitle: true })

  assert.equal((await f.manager.list()).sessions[0].title, 'Recovered predecessor title')
})

test('moves a cold persisted session to trash and restores it', async () => {
  const f = await fixture({ archived: true })

  const moved = await f.manager.trash(f.id)
  await assert.rejects(stat(f.sessionDirectory), /ENOENT/)
  assert.equal((await f.manager.list()).sessions.length, 0)
  assert.equal((await f.manager.list()).showSidebarTrash, true)
  const trashed = (await f.manager.list()).trash
  assert.equal(trashed.length, 1)
  assert.equal(trashed[0].title, 'Release validation')
  assert.equal(f.disposed(), false)
  assert.deepEqual(f.workspaceSessions, [])
  assert.deepEqual(f.registry.archivedSessionIds, [])
  assert.equal(f.projectionDeleted(), false)

  await f.manager.restore(moved.trashId)
  assert.equal(await readFile(f.artifact, 'utf8'), 'durable session bytes')
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), false)
  assert.deepEqual(f.workspaceSessions, [f.id])
  assert.deepEqual(f.registry.archivedSessionIds, [f.id])
  assert.equal(f.projectionRebuilt(), true)
})

test('trashes and deletes without waiting to migrate the log', async () => {
  const hung = new Promise(() => {})
  const trashed = await fixture()
  let prepared = false
  trashed.persistence.prepare = () => { prepared = true; return hung }
  const moved = await trashed.manager.trash(trashed.id)
  assert.equal(prepared, false)
  assert.equal(moved.sessionId, trashed.id)
  await assert.rejects(stat(trashed.artifact), /ENOENT/)

  const removed = await fixture()
  removed.persistence.prepare = () => hung
  await removed.manager.deleteForever(removed.id)
  await assert.rejects(stat(removed.artifact), /ENOENT/)
})

test('moves a directory across filesystems through a staged copy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-session-manager-exdev-'))
  roots.push(root)
  const source = join(root, 'source')
  const target = join(root, 'target')
  await mkdir(source)
  await writeFile(join(source, 'session.jsonl.zstd'), 'cross-volume bytes')
  let firstRename = true

  const fs = await import('node:fs/promises')
  await moveDirectory(source, target, {
    async rename(from, to) {
      if (firstRename) {
        firstRename = false
        const error = new Error('cross-device link not permitted')
        error.code = 'EXDEV'
        throw error
      }
      await fs.rename(from, to)
    },
    cp: fs.cp,
    rm: fs.rm,
  })

  assert.equal(await readFile(join(target, 'session.jsonl.zstd'), 'utf8'), 'cross-volume bytes')
  await assert.rejects(stat(source), /ENOENT/)
})

test('applies sidebar trash visibility changes without touching trash data', async () => {
  const f = await fixture()
  assert.equal((await f.manager.list()).showSidebarTrash, true)
  f.setShowSidebarTrash(false)
  assert.equal((await f.manager.list()).showSidebarTrash, false)
  assert.equal((await f.manager.list()).sessions.length, 1)
})

test('closes and moves an attached idle session', async () => {
  const f = await fixture({ live: true })
  await f.manager.trash(f.id)
  await assert.rejects(stat(f.artifact), /ENOENT/)
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
  await assert.rejects(active.manager.deleteForever(active.id), /运行中的会话不能永久删除/)
})

test('marks archived and blank sessions in the inventory', async () => {
  const f = await fixture({ archived: true, blank: true })
  const row = (await f.manager.list()).sessions[0]

  assert.equal(row.archived, true)
  assert.equal(row.blank, true)
})

test('permanently removes a trashed payload', async () => {
  const f = await fixture()
  const moved = await f.manager.trash(f.id)

  await f.manager.purge(moved.trashId)
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), false)
  assert.equal(f.projectionDeleted(), true)
  await assert.rejects(stat(f.artifact), /ENOENT/)
})

test('permanently deletes a cold session without using trash', async () => {
  const f = await fixture({ archived: true })

  const deleted = await f.manager.deleteForever(f.id)
  assert.equal(deleted.title, 'Release validation')
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), false)
  assert.deepEqual(f.workspaceSessions, [])
  assert.deepEqual(f.registry.archivedSessionIds, [])
  assert.equal(f.projectionDeleted(), true)
  await assert.rejects(stat(f.sessionDirectory), /ENOENT/)
})

test('closes and permanently deletes an attached idle session', async () => {
  const f = await fixture({ live: true })

  await f.manager.deleteForever(f.id)
  await assert.rejects(stat(f.artifact), /ENOENT/)
})

test('empties all valid trash entries', async () => {
  const f = await fixture()
  await f.manager.trash(f.id)

  assert.deepEqual(await f.manager.emptyTrash(), { deleted: 1 })
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), false)
  await assert.rejects(stat(f.artifact), /ENOENT/)
})

test('reconciles DSH client state without reloading the page', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.doesNotMatch(client, /location\.reload/)
  assert.match(client, /ctx\.sessions\.refresh\(\)/)
  assert.match(client, /ctx\.workspaces\.refresh\(\)/)
  assert.match(client, /const inject = \["slots", "sessions", "workspaces", "connection"\]/)
  assert.match(client, /sidebar\.footer\.action/)
  assert.match(client, /settings\.plugin\.item/)
  assert.match(client, /工作区下方显示回收站/)
  assert.match(client, /自动恢复意外中断的任务/)
  assert.match(client, /dsm-move-icon-source/)
  assert.match(client, /dsm-undo-icon/)
  assert.match(client, /dsm-icon-button\.dsm-danger/)
  assert.match(client, /background:var\(--dsw-alias-bg-layer-2\)/)
  assert.doesNotMatch(client, /background:var\(--dsw-specific-menu\)/)
  assert.match(client, /已归档/)
  assert.match(client, /空会话/)
  assert.match(client, /空闲/)
  assert.match(client, /搜索标题、路径或会话 ID/)
  assert.match(client, /未加入工作区/)
  assert.doesNotMatch(client, />已打开</)
  assert.match(client, /永久删除会话/)
  assert.match(client, /清空回收站/)
  assert.match(client, /批量移到回收站/)
  assert.match(client, /if \(failed.length > 0\)/)
  assert.match(client, /event.stopPropagation/)
  assert.match(client, /反选/)
  assert.match(client, /startsWith\("batch-"\) \? "batch"/)
  assert.match(client, /dsm-nav-icon-source/)
  assert.match(client, /width:28px;height:28px;min-width:28px;max-width:28px/)
  assert.doesNotMatch(client, /max-width:900px/)
  assert.doesNotMatch(client, /↻/)
})

test('declares recovery service dependencies so startup waits for native DSH services', () => {
  assert.deepEqual(inject, [
    'sessionPersistence',
    'sessions',
    'webServer',
    'agents',
    'agentPresets',
    'agentDefaultModel',
    'sessionProjectionCache',
  ])
})

test('keeps the recovery lease inside the configured trash directory', async () => {
  const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8')

  assert.match(indexSource, /leasePath: join\(resolve\(config\.trashDirectory\), '\.session-manager-recovery\.lock'\)/)
  assert.match(indexSource, /recovery\.observeEvent\(event\)/)
})
