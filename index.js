import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { symbols } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'session-manager'
export const inject = ['apiProxy', 'sessionPersistence', 'sessions', 'webServer']

const API_ROOT = '/plugins/@local/dsh-session-manager/api'
const MANIFEST_NAME = 'manifest.json'
const PAYLOAD_NAME = 'session'
const MAX_BODY_BYTES = 16 * 1024

export const Config = z.object({
  trashDirectory: z.string().default(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'trash')),
})

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  })
  res.end(body)
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

function sameOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJson(req) {
  if (req.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/json') {
    throw new Error('content-type must be application/json')
  }
  const chunks = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > MAX_BODY_BYTES) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value
}

function requireString(record, key) {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new Error(`${key} must be a non-empty string`)
  }
  return value
}

function titleFor(ctx, meta) {
  try {
    const session = ctx.sessions.get(meta.id)
    const snapshot = session === undefined
      ? ctx.get('sessionProjectionCache')?.cachedSnapshot(meta)
      : ctx.get('sessionProjections')?.snapshot(session)
    const title = snapshot?.values?.title
    if (typeof title === 'string' && title.trim().length > 0) return title.trim()
    const prompt = snapshot?.values?.sessionListMetadata?.latestHumanPrompt
    if (typeof prompt === 'string' && prompt.trim().length > 0) return prompt.trim().slice(0, 120)
  } catch {
    // Projection metadata is optional; session identity remains available.
  }
  return meta.id
}

function sessionState(ctx, sessionId) {
  const attached = ctx.sessions.get(sessionId) !== undefined
  const agent = ctx.get('agents')?.get(sessionId)
  const running = agent?.status === 'running'
  return { agent, attached, running }
}

async function closeIdleSession(ctx, sessionId, action) {
  const state = sessionState(ctx, sessionId)
  if (!state.attached) return
  if (state.running) throw new Error(`运行中的会话不能${action}，请等待任务结束`)
  if (state.agent?.status !== 'idle') {
    throw new Error(`无法确认会话已空闲，不能${action}`)
  }

  // ApiProxy owns browser-opened Agent handles but does not expose a close RPC.
  // Dispose its exact per-session Cordis effect so normal persistence teardown runs.
  const tracedApiProxy = ctx.get('apiProxy')
  const apiProxy = tracedApiProxy?.[symbols.original] ?? tracedApiProxy
  const disposables = apiProxy?.ctx?.fiber?._disposables
  const label = `agentLoop.lifecycle(${sessionId})`
  const lifecycles = disposables === undefined
    ? []
    : [...disposables].filter(dispose => dispose?.[symbols.effect]?.label === label)
  if (lifecycles.length !== 1) {
    throw new Error(`无法安全关闭空闲会话，不能${action}`)
  }
  await lifecycles[0]()
  const remaining = sessionState(ctx, sessionId)
  if (remaining.attached || remaining.agent !== undefined) {
    throw new Error(`空闲会话关闭失败，不能${action}`)
  }
}

async function fileSize(location) {
  if (location === undefined) return 0
  try {
    return (await stat(location.path)).size
  } catch {
    return 0
  }
}

function manifestPath(entryDirectory) {
  return join(entryDirectory, MANIFEST_NAME)
}

function timestampOf(value) {
  return typeof value === 'number' ? value : Date.parse(value)
}

async function readManifest(entryDirectory) {
  const value = JSON.parse(await readFile(manifestPath(entryDirectory), 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid trash manifest')
  for (const key of ['trashId', 'sessionId', 'title', 'cwd', 'trashedAt', 'originalDirectory']) {
    if (typeof value[key] !== 'string') throw new Error(`invalid trash manifest field: ${key}`)
  }
  if (typeof value.createdAt !== 'number' && typeof value.createdAt !== 'string') {
    throw new Error('invalid trash manifest field: createdAt')
  }
  if (value.workspaceIds !== undefined
    && (!Array.isArray(value.workspaceIds) || value.workspaceIds.some(id => typeof id !== 'string'))) {
    throw new Error('invalid trash manifest field: workspaceIds')
  }
  if (value.archived !== undefined && typeof value.archived !== 'boolean') {
    throw new Error('invalid trash manifest field: archived')
  }
  return value
}

async function findTrashEntry(trashDirectory, trashId) {
  const names = await readdir(trashDirectory).catch(error => {
    if (error?.code === 'ENOENT') return []
    throw error
  })
  if (!names.includes(trashId)) throw new Error('trash item not found')
  const entryDirectory = join(trashDirectory, trashId)
  const info = await lstat(entryDirectory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('invalid trash item')
  return { entryDirectory, manifest: await readManifest(entryDirectory) }
}

async function listTrash(trashDirectory) {
  const names = await readdir(trashDirectory).catch(error => {
    if (error?.code === 'ENOENT') return []
    throw error
  })
  const entries = []
  for (const name of names) {
    try {
      const { entryDirectory, manifest } = await findTrashEntry(trashDirectory, name)
      const payload = join(entryDirectory, PAYLOAD_NAME)
      entries.push({
        trashId: manifest.trashId,
        sessionId: manifest.sessionId,
        title: manifest.title,
        cwd: manifest.cwd,
        createdAt: manifest.createdAt,
        trashedAt: manifest.trashedAt,
        size: await directorySize(payload),
      })
    } catch {
      // Ignore incomplete entries; they remain available for manual recovery.
    }
  }
  return entries.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt))
}

async function directorySize(path) {
  const info = await lstat(path)
  if (!info.isDirectory()) return info.size
  let total = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    total += await directorySize(join(path, entry.name))
  }
  return total
}

function sessionDirectoryFor(ctx, meta) {
  const location = ctx.sessionPersistence.locate(meta)
  if (location === undefined) throw new Error('the active persistence backend has no movable session artifact')
  const sessionDirectory = dirname(location.path)
  if (basename(sessionDirectory) !== meta.id) throw new Error('unexpected session storage layout')
  return { location, sessionDirectory }
}

async function requireStoredSession(ctx, sessionId) {
  const headers = await ctx.sessionPersistence.list()
  const meta = headers.find(header => header.id === sessionId)
  if (meta === undefined) throw new Error('session not found')
  return meta
}

function workspaceMetadata(ctx, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined) return { workspaceIds: [], archived: false }
  return {
    workspaceIds: registry.list()
      .filter(workspace => workspace.sessionIds.includes(sessionId))
      .map(workspace => workspace.id),
    archived: registry.archivedSessionIds.includes(sessionId),
  }
}

async function removeProjectionMetadata(ctx, sessionId) {
  await ctx.get('sessionProjectionCache')?.table?.delete(sessionId)
}

async function cleanDerivedMetadata(ctx, sessionId, metadata, removeProjection) {
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    for (const workspaceId of metadata.workspaceIds) {
      await registry.get(workspaceId)?.detachSession(sessionId)
    }
    if (metadata.archived && registry.state !== undefined && typeof registry.setState === 'function') {
      await registry.setState({
        ...registry.state,
        archivedSessionIds: registry.state.archivedSessionIds.filter(id => id !== sessionId),
      })
    }
    registry.headers?.delete(sessionId)
    registry.sessionPaths?.delete(sessionId)
    registry.invalidSessionPaths?.delete(sessionId)
  }
  if (removeProjection) await removeProjectionMetadata(ctx, sessionId)
}

async function restoreWorkspaceMetadata(ctx, manifest) {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined) return
  for (const workspaceId of manifest.workspaceIds ?? []) {
    await registry.get(workspaceId)?.attachSession(manifest.sessionId)
  }
  if (manifest.archived === true) await registry.archiveSession(manifest.sessionId)
}

export class SessionTrashManager {
  constructor(ctx, config) {
    this.ctx = ctx
    this.trashDirectory = resolve(config.trashDirectory)
    this.reservations = new Map()
  }

  async list() {
    const headers = await this.ctx.sessionPersistence.list()
    const sessions = await Promise.all(headers.map(async meta => {
      const location = this.ctx.sessionPersistence.locate(meta)
      const state = sessionState(this.ctx, meta.id)
      return {
        id: meta.id,
        title: titleFor(this.ctx, meta),
        cwd: meta.cwd,
        createdAt: meta.createdAt,
        attached: state.attached,
        running: state.running,
        size: await fileSize(location),
      }
    }))
    sessions.sort((a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt))
    return { sessions, trash: await listTrash(this.trashDirectory) }
  }

  async trash(sessionId) {
    const initialState = sessionState(this.ctx, sessionId)
    if (initialState.running) {
      throw new Error('运行中的会话不能删除，请等待任务结束')
    }
    await closeIdleSession(this.ctx, sessionId, '移动到回收站')
    const meta = await requireStoredSession(this.ctx, sessionId)
    const preparation = await this.ctx.sessionPersistence.prepare(meta.id)
    let entryDirectory
    try {
      const reservedState = sessionState(this.ctx, sessionId)
      if (reservedState.running) {
        throw new Error('运行中的会话不能删除，请等待任务结束')
      }
      if (reservedState.attached) {
        throw new Error('已打开的会话不能删除，请先切换到其他会话')
      }
      const preparedMeta = preparation.session.header
      const { sessionDirectory } = sessionDirectoryFor(this.ctx, preparedMeta)
      const metadata = workspaceMetadata(this.ctx, sessionId)
      const sessionInfo = await lstat(sessionDirectory)
      if (!sessionInfo.isDirectory() || sessionInfo.isSymbolicLink()) throw new Error('invalid session directory')
      await mkdir(this.trashDirectory, { recursive: true, mode: 0o700 })
      const trashedAt = new Date().toISOString()
      const trashId = `${trashedAt.replaceAll(':', '-')}-${sessionId}-${randomUUID().slice(0, 8)}`
      entryDirectory = join(this.trashDirectory, trashId)
      await mkdir(entryDirectory, { mode: 0o700 })
      const manifest = {
        version: 1,
        trashId,
        sessionId,
        title: titleFor(this.ctx, preparedMeta),
        cwd: preparedMeta.cwd,
        createdAt: preparedMeta.createdAt,
        trashedAt,
        originalDirectory: sessionDirectory,
        workspaceIds: metadata.workspaceIds,
        archived: metadata.archived,
      }
      await writeFile(manifestPath(entryDirectory), `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: 'wx',
        mode: 0o600,
      })
      await rename(sessionDirectory, join(entryDirectory, PAYLOAD_NAME))
      await cleanDerivedMetadata(this.ctx, sessionId, metadata, false).catch(error => {
        this.ctx.logger?.warn(`session-manager: moved "${sessionId}" but could not remove all derived metadata: ${errorMessage(error)}`)
      })
      this.reservations.set(sessionId, preparation)
      return manifest
    } catch (error) {
      preparation[Symbol.dispose]()
      if (entryDirectory !== undefined) {
        await rm(entryDirectory, { recursive: true, force: true }).catch(() => {})
      }
      throw error
    }
  }

  async deleteForever(sessionId) {
    const initialState = sessionState(this.ctx, sessionId)
    if (initialState.running) {
      throw new Error('运行中的会话不能永久删除，请等待任务结束')
    }
    await closeIdleSession(this.ctx, sessionId, '永久删除')
    const meta = await requireStoredSession(this.ctx, sessionId)
    const preparation = await this.ctx.sessionPersistence.prepare(meta.id)
    try {
      const reservedState = sessionState(this.ctx, sessionId)
      if (reservedState.running) {
        throw new Error('运行中的会话不能永久删除，请等待任务结束')
      }
      if (reservedState.attached) {
        throw new Error('已打开的会话不能永久删除，请先切换到其他会话')
      }
      const preparedMeta = preparation.session.header
      const { sessionDirectory } = sessionDirectoryFor(this.ctx, preparedMeta)
      const metadata = workspaceMetadata(this.ctx, sessionId)
      const sessionInfo = await lstat(sessionDirectory)
      if (!sessionInfo.isDirectory() || sessionInfo.isSymbolicLink()) throw new Error('invalid session directory')
      const title = titleFor(this.ctx, preparedMeta)
      await rm(sessionDirectory, { recursive: true })
      await cleanDerivedMetadata(this.ctx, sessionId, metadata, true).catch(error => {
        this.ctx.logger?.warn(`session-manager: deleted "${sessionId}" but could not remove all derived metadata: ${errorMessage(error)}`)
      })
      return { sessionId, title }
    } finally {
      preparation[Symbol.dispose]()
    }
  }

  async restore(trashId) {
    const { entryDirectory, manifest } = await findTrashEntry(this.trashDirectory, trashId)
    if (this.ctx.sessions.get(manifest.sessionId) !== undefined) throw new Error('a live session already uses this id')
    const headers = await this.ctx.sessionPersistence.list()
    if (headers.some(header => header.id === manifest.sessionId)) throw new Error('a stored session already uses this id')
    await mkdir(dirname(manifest.originalDirectory), { recursive: true, mode: 0o700 })
    await access(manifest.originalDirectory, constants.F_OK).then(
      () => { throw new Error('the original session directory already exists') },
      error => { if (error?.code !== 'ENOENT') throw error },
    )
    await rename(join(entryDirectory, PAYLOAD_NAME), manifest.originalDirectory)
    await this.ctx.get('sessionProjectionCache')?.coldSnapshot(manifest.sessionId).catch(error => {
      this.ctx.logger?.warn(`session-manager: restored "${manifest.sessionId}" but could not rebuild its title metadata: ${errorMessage(error)}`)
    })
    await restoreWorkspaceMetadata(this.ctx, manifest).catch(error => {
      this.ctx.logger?.warn(`session-manager: restored "${manifest.sessionId}" but could not restore all workspace metadata: ${errorMessage(error)}`)
    })
    this.releaseReservation(manifest.sessionId)
    await rm(entryDirectory, { recursive: true, force: true }).catch(error => {
      this.ctx.logger?.warn(`session-manager: restored "${manifest.sessionId}" but could not remove its empty trash entry: ${errorMessage(error)}`)
    })
    return manifest
  }

  async purge(trashId) {
    const { entryDirectory, manifest } = await findTrashEntry(this.trashDirectory, trashId)
    await rm(entryDirectory, { recursive: true })
    await removeProjectionMetadata(this.ctx, manifest.sessionId).catch(error => {
      this.ctx.logger?.warn(`session-manager: purged "${manifest.sessionId}" but could not remove its title metadata: ${errorMessage(error)}`)
    })
    this.releaseReservation(manifest.sessionId)
    return manifest
  }

  async emptyTrash() {
    const entries = await listTrash(this.trashDirectory)
    for (const entry of entries) await this.purge(entry.trashId)
    return { deleted: entries.length }
  }

  releaseReservation(sessionId) {
    const preparation = this.reservations.get(sessionId)
    if (preparation === undefined) return
    this.reservations.delete(sessionId)
    preparation[Symbol.dispose]()
  }

  dispose() {
    for (const sessionId of [...this.reservations.keys()]) this.releaseReservation(sessionId)
  }
}

function registerRoute(ctx, route, handler) {
  return ctx.webServer.register({
    kind: 'exact',
    path: `${API_ROOT}/${route}`,
    async handler(req, res) {
      try {
        if (req.method === 'GET' && route === 'sessions') {
          json(res, 200, { ok: true, value: await handler({}) })
          return
        }
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        if (!sameOrigin(req)) {
          json(res, 403, { ok: false, error: 'same-origin request required' })
          return
        }
        json(res, 200, { ok: true, value: await handler(await readJson(req)) })
      } catch (error) {
        json(res, 400, { ok: false, error: errorMessage(error) })
      }
    },
  })
}

export function apply(ctx, config) {
  const manager = new SessionTrashManager(ctx, config)
  ctx.effect(() => {
    const disposers = [
      registerRoute(ctx, 'sessions', () => manager.list()),
      registerRoute(ctx, 'trash', body => manager.trash(requireString(body, 'sessionId'))),
      registerRoute(ctx, 'delete', body => manager.deleteForever(requireString(body, 'sessionId'))),
      registerRoute(ctx, 'restore', body => manager.restore(requireString(body, 'trashId'))),
      registerRoute(ctx, 'purge', body => manager.purge(requireString(body, 'trashId'))),
      registerRoute(ctx, 'empty', () => manager.emptyTrash()),
    ]
    return () => {
      for (const dispose of disposers) dispose()
      manager.dispose()
    }
  }, 'session-manager routes')
}
