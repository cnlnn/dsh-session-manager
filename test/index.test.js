import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { moveDirectory, SessionTrashManager } from '../index.js'

const roots = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture({ live = false, running = false, archived = false, blank = false } = {}) {
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
    cachedSnapshot: () => ({ values: { title: 'Release validation', sessionListMetadata: { blank } } }),
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
  }
}

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
  assert.equal(f.disposed(), true)
  assert.deepEqual(f.workspaceSessions, [f.id])
  assert.deepEqual(f.registry.archivedSessionIds, [f.id])
  assert.equal(f.projectionRebuilt(), true)
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
  assert.equal(f.disposed(), true)
  assert.equal(f.projectionDeleted(), true)
  await assert.rejects(stat(f.artifact), /ENOENT/)
})

test('permanently deletes a cold session without using trash', async () => {
  const f = await fixture({ archived: true })

  const deleted = await f.manager.deleteForever(f.id)
  assert.equal(deleted.title, 'Release validation')
  assert.equal((await f.manager.list()).trash.length, 0)
  assert.equal(f.disposed(), true)
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
  assert.equal(f.disposed(), true)
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
  assert.match(client, /dsm-move-icon-source/)
  assert.match(client, /dsm-undo-icon/)
  assert.match(client, /dsm-icon-button\.dsm-danger/)
  assert.match(client, /已归档/)
  assert.match(client, /空会话/)
  assert.match(client, /空闲/)
  assert.match(client, /搜索标题、路径或会话 ID/)
  assert.match(client, /未加入工作区/)
  assert.doesNotMatch(client, />已打开</)
  assert.match(client, /永久删除会话/)
  assert.match(client, /清空回收站/)
})
