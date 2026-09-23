import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access,
  cp,
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
import * as settings from '@deepseek-ai/dsh-settings'
import { RecoveryClaimStore, SessionRecoveryCoordinator } from './lib/recovery.js'
import { rebuildProjection, reserveStored, settingValue, storedHeaders } from './lib/compat.js'

export {
  DEFAULT_RECOVERY_MAX_AGE_MS,
  DEFAULT_RECOVERY_LOCK_HEARTBEAT_MS,
  RecoveryClaimStore,
  SessionRecoveryCoordinator,
  acquireRecoveryLease,
  recoveryFacts,
} from './lib/recovery.js'

export const name = 'session-manager'
export const inject = [
  'sessionPersistence',
  'sessions',
  'webServer',
  'agents',
  'agentPresets',
  'agentDefaultModel',
  'sessionProjectionCache',
]

const API_ROOT = '/plugins/@local/dsh-session-manager/api'
const MANIFEST_NAME = 'manifest.json'
const PAYLOAD_NAME = 'session'
const MAX_BODY_BYTES = 16 * 1024
export const SETTINGS_NAMESPACE = settings.settingsNamespace?.('session-manager') ?? 'session-manager'

function liveSetting(schema) {
  return typeof schema.volatile === 'function' ? schema.volatile() : schema
}

export const Config = z.object({
  trashDirectory: z.string().default(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'trash')),
  showSidebarTrash: liveSetting(z.boolean().default(true).description('工作区下方显示回收站')),
  autoRecoverInterruptedGoals: liveSetting(z.boolean().default(true).description('自动恢复意外中断的任务')),
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

/** Move a directory without assuming the trash directory is on the same filesystem. */
export async function moveDirectory(source, target, operations = { rename, cp, rm }) {
  try {
    await operations.rename(source, target)
    return
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error
  }

  const temporary = `${target}.copy-${randomUUID()}`
  try {
    await operations.cp(source, temporary, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    })
    await operations.rename(temporary, target)
  } catch (error) {
    await operations.rm(temporary, { recursive: true, force: true }).catch(() => {})
    throw error
  }

  try {
    await operations.rm(source, { recursive: true })
  } catch (error) {
    error.preserveDestination = true
    throw error
  }
}

function projectionFor(ctx, meta) {
  try {
    const session = ctx.sessions.get(meta.id)
    return session === undefined
      ? ctx.get('sessionProjectionCache')?.cachedSnapshot(meta)
      : ctx.get('sessionProjections')?.snapshot(session)
  } catch {
    return undefined
  }
}

function titleFor(ctx, meta, snapshot = projectionFor(ctx, meta)) {
  try {
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

  // Browser-opened Agent handles live on the owner fiber as agentLoop.lifecycle(id).
  // 0.1.1 used apiProxy; 0.1.5 dropped that service, so also search agents / this fiber.
  const label = `agentLoop.lifecycle(${sessionId})`
  const fibers = []
  for (const name of ['apiProxy', 'sessionController', 'agents', 'agentLoop']) {
    const service = ctx.get(name)
    const unwrapped = service?.[symbols.original] ?? service
    const fiber = unwrapped?.ctx?.fiber
    if (fiber !== undefined) fibers.push(fiber)
  }
  if (ctx.fiber !== undefined) fibers.push(ctx.fiber)
  const lifecycles = []
  const seen = new Set()
  for (const fiber of fibers) {
    const effects = typeof fiber.getEffects === 'function' ? fiber.getEffects() : undefined
    if (Array.isArray(effects)) {
      for (const effect of effects) {
        if (effect?.label !== label) continue
        const dispose = typeof effect.dispose === 'function' ? effect.dispose : typeof effect === 'function' ? effect : undefined
        if (dispose !== undefined && !seen.has(dispose)) {
          seen.add(dispose)
          lifecycles.push(dispose)
        }
      }
    }
    const disposables = fiber._disposables
    if (disposables === undefined) continue
    for (const dispose of disposables) {
      if (dispose?.[symbols.effect]?.label !== label || seen.has(dispose)) continue
      seen.add(dispose)
      lifecycles.push(dispose)
    }
  }
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
  const location = ctx.sessionPersistence.locate?.(meta)
  if (location === undefined) throw new Error('the active persistence backend has no movable session artifact')
  const sessionDirectory = dirname(location.path)
  if (basename(sessionDirectory) !== meta.id) throw new Error('unexpected session storage layout')
  return { location, sessionDirectory }
}

async function requireStoredSession(ctx, sessionId) {
  const headers = await storedHeaders(ctx.sessionPersistence)
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
    pinned: registry.pinnedSessionIds?.includes(sessionId) ?? false,
  }
}

async function removeProjectionMetadata(ctx, sessionId) {
  await ctx.get('sessionProjectionCache')?.table?.delete(sessionId)
}

async function cleanDerivedMetadata(ctx, sessionId, metadata, removeProjection) {
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    if (metadata.pinned) await registry.unpinSession?.(sessionId)
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
  else if (manifest.pinned === true) await registry.pinSession?.(manifest.sessionId)
}

export class SessionTrashManager {
  constructor(ctx, config) {
    this.ctx = ctx
    this.trashDirectory = resolve(config.trashDirectory)
    this.showSidebarTrash = () => config.showSidebarTrash ?? true
    this.reservations = new Map()
  }

  async list() {
    const headers = await storedHeaders(this.ctx.sessionPersistence)
    const sessions = await Promise.all(headers.map(async meta => {
      const location = this.ctx.sessionPersistence.locate?.(meta)
      const state = sessionState(this.ctx, meta.id)
      const snapshot = projectionFor(this.ctx, meta)
      const metadata = workspaceMetadata(this.ctx, meta.id)
      return {
        id: meta.id,
        title: titleFor(this.ctx, meta, snapshot),
        cwd: meta.cwd,
        createdAt: meta.createdAt,
        archived: metadata.archived,
        pinned: metadata.pinned,
        workspaceIds: metadata.workspaceIds,
        attached: state.attached,
        blank: snapshot?.values?.sessionListMetadata?.blank === true,
        running: state.running,
        size: location === undefined ? 0 : await directorySize(dirname(location.path)).catch(() => fileSize(location)),
      }
    }))
    sessions.sort((a, b) => timestampOf(b.createdAt) - timestampOf(a.createdAt))
    return {
      sessions,
      trash: await listTrash(this.trashDirectory),
      showSidebarTrash: this.showSidebarTrash(),
    }
  }

  async trash(sessionId) {
    const initialState = sessionState(this.ctx, sessionId)
    if (initialState.running) {
      throw new Error('运行中的会话不能删除，请等待任务结束')
    }
    await closeIdleSession(this.ctx, sessionId, '移动到回收站')
    const meta = await requireStoredSession(this.ctx, sessionId)
    const preparation = await reserveStored(this.ctx.sessionPersistence, meta.id)
    let entryDirectory
    let payloadMoved = false
    try {
      const reservedState = sessionState(this.ctx, sessionId)
      if (reservedState.running) {
        throw new Error('运行中的会话不能删除，请等待任务结束')
      }
      if (reservedState.attached) {
        throw new Error('已打开的会话不能删除，请先切换到其他会话')
      }
      const preparedMeta = preparation.header
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
        pinned: metadata.pinned,
      }
      await writeFile(manifestPath(entryDirectory), `${JSON.stringify(manifest, null, 2)}\n`, {
        flag: 'wx',
        mode: 0o600,
      })
      await moveDirectory(sessionDirectory, join(entryDirectory, PAYLOAD_NAME))
      payloadMoved = true
      await cleanDerivedMetadata(this.ctx, sessionId, metadata, false).catch(error => {
        this.ctx.logger?.warn(`session-manager: moved "${sessionId}" but could not remove all derived metadata: ${errorMessage(error)}`)
      })
      if (preparation.retain) this.reservations.set(sessionId, preparation)
      else await preparation.release()
      return manifest
    } catch (error) {
      await preparation.release()
      if (entryDirectory !== undefined && !payloadMoved && error?.preserveDestination !== true) {
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
    const preparation = await reserveStored(this.ctx.sessionPersistence, meta.id)
    try {
      const reservedState = sessionState(this.ctx, sessionId)
      if (reservedState.running) {
        throw new Error('运行中的会话不能永久删除，请等待任务结束')
      }
      if (reservedState.attached) {
        throw new Error('已打开的会话不能永久删除，请先切换到其他会话')
      }
      const preparedMeta = preparation.header
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
      await preparation.release()
    }
  }

  async restore(trashId) {
    const { entryDirectory, manifest } = await findTrashEntry(this.trashDirectory, trashId)
    if (this.ctx.sessions.get(manifest.sessionId) !== undefined) throw new Error('a live session already uses this id')
    const headers = await storedHeaders(this.ctx.sessionPersistence)
    if (headers.some(header => header.id === manifest.sessionId)) throw new Error('a stored session already uses this id')
    await mkdir(dirname(manifest.originalDirectory), { recursive: true, mode: 0o700 })
    await access(manifest.originalDirectory, constants.F_OK).then(
      () => { throw new Error('the original session directory already exists') },
      error => { if (error?.code !== 'ENOENT') throw error },
    )
    await moveDirectory(join(entryDirectory, PAYLOAD_NAME), manifest.originalDirectory)
    await rebuildProjection(this.ctx, manifest.sessionId).catch(error => {
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
    preparation.release()
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
  let settingsSource = () => ({
    showSidebarTrash: settingValue(config.showSidebarTrash, true),
    autoRecoverInterruptedGoals: settingValue(config.autoRecoverInterruptedGoals, true),
  })
  const manager = new SessionTrashManager(ctx, {
    ...config,
    get showSidebarTrash() { return settingsSource().showSidebarTrash },
  })
  const claimStore = new RecoveryClaimStore(join(resolve(config.trashDirectory), '.session-manager-recovery-claims.json'))
  const recovery = new SessionRecoveryCoordinator(ctx, {
    enabled: () => settingsSource().autoRecoverInterruptedGoals,
    leasePath: join(resolve(config.trashDirectory), '.session-manager-recovery.lock'),
    claimStore,
  })
  const settingsArgs = [
    SETTINGS_NAMESPACE,
    z.object({
      showSidebarTrash: z.boolean().default(true).description('工作区下方显示回收站'),
      autoRecoverInterruptedGoals: z.boolean().default(true).description('自动恢复意外中断的任务'),
    }),
    settingsSource(),
    {
      setSource(source) { settingsSource = source },
      onChange() { recovery.setEnabled(() => settingsSource().autoRecoverInterruptedGoals) },
    },
  ]
  if (typeof settings.installSettingsSection === 'function') settings.installSettingsSection(ctx, ...settingsArgs)
  else {
    ctx.inject(['settings'], sctx => {
      if (typeof sctx.settings.installSection === 'function') sctx.settings.installSection(ctx, ...settingsArgs)
      else sctx.effect(() => sctx.settings.configure({ auto: false }, ctx.fiber))
    })
    ctx.on('settings/document-updated', () => {
      recovery.setEnabled(() => settingsSource().autoRecoverInterruptedGoals)
    })
  }
  ctx.on('session/event', (session, event) => {
    claimStore.observe(session, event, settingsSource().autoRecoverInterruptedGoals)
    recovery.observeEvent(event)
  })
  ctx.effect(() => {
    const disposers = [
      registerRoute(ctx, 'sessions', () => manager.list()),
      registerRoute(ctx, 'trash', body => manager.trash(requireString(body, 'sessionId'))),
      registerRoute(ctx, 'delete', body => manager.deleteForever(requireString(body, 'sessionId'))),
      registerRoute(ctx, 'restore', body => manager.restore(requireString(body, 'trashId'))),
      registerRoute(ctx, 'purge', body => manager.purge(requireString(body, 'trashId'))),
      registerRoute(ctx, 'empty', () => manager.emptyTrash()),
    ]
    recovery.start()
    return () => {
      const pending = recovery.dispose()
      for (const dispose of disposers) dispose()
      manager.dispose()
      return Promise.all([pending, claimStore.dispose()])
    }
  }, 'session-manager routes')
}
