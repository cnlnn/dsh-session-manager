import { randomUUID } from 'node:crypto'
import { open, mkdir, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { dirname } from 'node:path'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { hasApiRemoteSubagentOwner, inspectApiRemoteSession } from '@deepseek-ai/dsh-api-remotes'
import { resolveSessionPreset } from '@deepseek-ai/dsh-agent-presets'
import { foldGoal } from '@deepseek-ai/dsh-goal'
import { interruptedTurnClosers, TOOL_OUTCOME_UNKNOWN } from '@deepseek-ai/dsh-session'

export const DEFAULT_RECOVERY_DELAY_MS = 1500
export const DEFAULT_RECOVERY_LOCK_STALE_MS = 15 * 60 * 1000
export const DEFAULT_RECOVERY_LOCK_HEARTBEAT_MS = 5 * 60 * 1000
export const DEFAULT_RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000
const CLAIMS_VERSION = 2

function service(ctx, name) {
  return ctx?.[name] ?? ctx?.get?.(name)
}

function goalServiceFor(ctx, agent) {
  const presets = service(ctx, 'agentPresets')
  return presets?.serviceFor?.(agent, 'goals') ?? service(ctx, 'goals')
}

function errorType(error) {
  if (typeof error?.code === 'string') return error.code
  if (typeof error?.name === 'string') return error.name
  return 'Error'
}

function log(ctx, level, code, sessionId, fields = {}) {
  const logger = ctx?.logger
  const method = logger?.[level]
  if (typeof method !== 'function') return
  // Keep recovery diagnostics structured and deliberately exclude event bodies,
  // prompts, tool arguments, and provider error messages.
  const safeFields = Object.entries(fields)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => `${key}=${String(value)}`)
  method.call(logger, `session-manager recovery code=${code} session=${sessionId ?? '-'}${safeFields.length === 0 ? '' : ` ${safeFields.join(' ')}`}`)
}

async function readLease(location) {
  let value
  try {
    value = JSON.parse(await readFile(location, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    return { createdAt: undefined, malformed: true }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { createdAt: undefined, malformed: true }
  }
  return {
    token: typeof value.token === 'string' ? value.token : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
    malformed: typeof value.token !== 'string' || typeof value.createdAt !== 'number',
  }
}

/**
 * Acquire an inter-process recovery lease. The lock is an ordinary exclusive
 * file, so it works on Linux, macOS, and Windows without a native dependency.
 * A stale lock is atomically renamed out of the way before retrying.
 */
export async function acquireRecoveryLease(location, {
  now = Date.now(),
  clock = Date.now,
  staleAfterMs = DEFAULT_RECOVERY_LOCK_STALE_MS,
  heartbeatMs = Math.min(DEFAULT_RECOVERY_LOCK_HEARTBEAT_MS, Math.max(1, Math.floor(staleAfterMs / 3))),
  owner = `${hostname()}:${process.pid}`,
} = {}) {
  await mkdir(dirname(location), { recursive: true, mode: 0o700 })
  const token = randomUUID()
  const initialTime = typeof now === 'function' ? now() : now
  const readClock = typeof clock === 'function' ? clock : () => Date.now()
  for (;;) {
    let handle
    let created = false
    try {
      handle = await open(location, 'wx', 0o600)
      created = true
      await handle.writeFile(`${JSON.stringify({
        version: 1,
        token,
        owner,
        createdAt: initialTime,
      })}\n`, 'utf8')
      await handle.close()
      let released = false
      let heartbeatRun = Promise.resolve()
      let heartbeatTimer
      const stopHeartbeat = () => {
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer)
        heartbeatTimer = undefined
      }
      const beat = async () => {
        if (released) return
        const current = await readLease(location)
        if (current?.token !== token) {
          stopHeartbeat()
          return
        }
        // Keep the lock's mtime fresh without rewriting its JSON. This avoids a
        // partially-written lease being mistaken for a stale one by a contender.
        const beatTime = new Date(readClock())
        await utimes(location, beatTime, beatTime)
      }
      if (Number.isFinite(heartbeatMs) && heartbeatMs > 0) {
        heartbeatTimer = setInterval(() => {
          heartbeatRun = heartbeatRun.then(beat, beat).catch(() => {})
        }, heartbeatMs)
        heartbeatTimer.unref?.()
      }
      return {
        location,
        token,
        async release() {
          if (released) return
          released = true
          stopHeartbeat()
          await heartbeatRun
          const current = await readLease(location)
          if (current?.token !== token) return
          await rm(location, { force: true })
        },
      }
    } catch (error) {
      if (handle !== undefined) await handle.close().catch(() => {})
      if (created) await rm(location, { force: true }).catch(() => {})
      if (error?.code !== 'EEXIST') throw error

      const observed = await readLease(location)
      if (observed === undefined || observed.malformed) return undefined
      let modifiedAt
      try {
        // The mtime is the heartbeat. The JSON createdAt is intentionally
        // immutable and is used only as metadata for diagnostics.
        modifiedAt = (await stat(location)).mtimeMs
      } catch (statError) {
        if (statError?.code === 'ENOENT') continue
        return undefined
      }
      const currentTime = typeof now === 'function' ? now() : now
      const age = Math.max(0, currentTime - modifiedAt)
      if (age <= staleAfterMs) return undefined

      // A heartbeat may have landed while the age calculation was running.
      // Re-read the mtime immediately before the atomic rename so a contender
      // does not reclaim a lease that was refreshed during this attempt.
      try {
        if ((await stat(location)).mtimeMs !== modifiedAt) continue
        const confirmed = await readLease(location)
        if (confirmed?.token !== observed.token) continue
      } catch (statError) {
        if (statError?.code === 'ENOENT') continue
        return undefined
      }

      const staleLocation = `${location}.stale-${token}`
      try {
        // rename() is the compare-and-remove boundary: another contender can
        // win the race, but neither contender blindly deletes a new lock.
        await rename(location, staleLocation)
        await rm(staleLocation, { force: true })
      } catch (renameError) {
        if (renameError?.code !== 'ENOENT') return undefined
      }
    }
  }
}

function sessionLifecycle(value) {
  const header = value?.header ?? value
  if (!Number.isSafeInteger(header?.createdAt) || header.createdAt < 0) return undefined
  if (header.cwd !== undefined && typeof header.cwd !== 'string') return undefined
  return {
    createdAt: header.createdAt,
    ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
  }
}

function sameLifecycle(left, right) {
  return left?.createdAt === right?.createdAt
    && left?.cwd === right?.cwd
}

/**
 * Durable opt-in records for unattended continuation. Goal activation itself is
 * intentionally process-local in DSH, so this small sidecar records the exact
 * session lifecycle and goal revision the user enabled while this plugin was active.
 */
export class RecoveryClaimStore {
  constructor(location) {
    this.location = location
    this.loaded = false
    this.claims = new Map()
    this.chain = Promise.resolve()
    this.disposed = false
  }

  async load() {
    if (this.loaded) return
    let value
    try {
      value = JSON.parse(await readFile(this.location, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        this.loaded = true
        return
      }
      throw error
    }
    if (value?.version !== CLAIMS_VERSION || !Array.isArray(value.claims)) {
      throw new Error('invalid recovery claims file')
    }
    for (const claim of value.claims) {
      const lifecycle = sessionLifecycle(claim)
      if (typeof claim?.sessionId !== 'string'
        || typeof claim.goalId !== 'string'
        || claim.phase !== 'active'
        || !Number.isSafeInteger(claim.revision)
        || claim.revision < 1
        || lifecycle === undefined) {
        throw new Error('invalid recovery claim')
      }
      this.claims.set(claim.sessionId, {
        sessionId: claim.sessionId,
        goalId: claim.goalId,
        revision: claim.revision,
        phase: 'active',
        ...lifecycle,
      })
    }
    this.loaded = true
  }

  async persist() {
    await mkdir(dirname(this.location), { recursive: true, mode: 0o700 })
    const temporary = `${this.location}.tmp-${randomUUID()}`
    await writeFile(temporary, `${JSON.stringify({
      version: CLAIMS_VERSION,
      claims: [...this.claims.values()],
    })}\n`, { encoding: 'utf8', mode: 0o600 })
    try {
      await rename(temporary, this.location)
    } catch (error) {
      // Windows does not replace an existing file with rename(). Removing the
      // destination after a failed atomic replacement is fail-closed: a crash
      // here can lose a claim, but can never create an unverified claim.
      if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') throw error
      await rm(this.location, { force: true })
      await rename(temporary, this.location)
    } finally {
      await rm(temporary, { force: true }).catch(() => {})
    }
  }

  enqueue(operation) {
    const result = this.chain.then(operation)
    this.chain = result.catch(() => {})
    return result
  }

  async allows(sessionId, goal, lifecycle) {
    return this.enqueue(async () => {
      await this.load()
      const claim = this.claims.get(sessionId)
      return claim?.phase === 'active'
        && claim.goalId === goal?.id
        && claim.revision === goal?.revision
        && sameLifecycle(claim, sessionLifecycle(lifecycle))
    })
  }

  claim(sessionId, goalId, revision, lifecycle) {
    if (this.disposed) return Promise.resolve()
    return this.enqueue(async () => {
      await this.load()
      if (typeof sessionId !== 'string' || typeof goalId !== 'string'
        || !Number.isSafeInteger(revision) || revision < 1) return
      const identity = sessionLifecycle(lifecycle)
      if (identity === undefined) return
      this.claims.set(sessionId, { sessionId, goalId, revision, phase: 'active', ...identity })
      await this.persist()
    })
  }

  revoke(sessionId) {
    if (this.disposed) return Promise.resolve()
    return this.enqueue(async () => {
      await this.load()
      if (!this.claims.delete(sessionId)) return
      await this.persist()
    })
  }

  observe(sessionOrId, event, enabled) {
    if (!enabled || event?.type !== 'goal/change') return
    const sessionId = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId?.id
    const lifecycle = typeof sessionOrId === 'string' ? undefined : sessionOrId
    const operation = event.data?.operation
    if (operation === 'create' || operation === 'resume') {
      const goal = event.data?.goal
      void this.claim(sessionId, goal?.id, goal?.revision, lifecycle).catch(() => {})
      return
    }
    if (operation === 'clear' || operation === 'pause' || operation === 'complete' || operation === 'block') {
      void this.revoke(sessionId).catch(() => {})
    }
  }

  async dispose() {
    this.disposed = true
    await this.chain
  }
}

function lastTurnEndIndex(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'turn/end') return index
  }
  return -1
}

function executionTrace(events) {
  let openTurn = null
  let openStep = null
  let lastTurnStartIndex = -1
  let pendingAtLastTurnEnd = 0
  let lastTurnEndReason
  const pendingCalls = new Set()
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    switch (event?.type) {
      case 'turn/start':
        openTurn = event.data?.turn ?? null
        openStep = null
        lastTurnStartIndex = index
        pendingCalls.clear()
        break
      case 'turn/end':
        pendingAtLastTurnEnd = pendingCalls.size
        lastTurnEndReason = event.data?.reason?.kind
        openTurn = null
        openStep = null
        pendingCalls.clear()
        break
      case 'step/start':
        openStep = event.data?.step ?? null
        break
      case 'step/end':
        openStep = null
        break
      case 'tool/call':
        if (typeof event.data?.callId === 'string') pendingCalls.add(event.data.callId)
        break
      case 'tool/result':
        if (typeof event.data?.message?.source?.callId === 'string') {
          pendingCalls.delete(event.data.message.source.callId)
        }
        break
      default:
        break
    }
  }
  return {
    openTurn,
    openStep,
    pendingToolCalls: openTurn === null ? pendingAtLastTurnEnd : pendingCalls.size,
    lastTurnStartIndex,
    lastTurnEndReason,
  }
}

function unknownToolOutcomesForTail(events, closers, endingIndex, trace) {
  const startIndex = trace.lastTurnStartIndex < 0
    ? 0
    : trace.lastTurnStartIndex
  // An unbalanced tail has not been durably repaired yet. Restrict both raw
  // and synthetic outcomes to the current tail; older completed turns are
  // historical evidence, not a current block.
  const endIndex = trace.openTurn !== null
    ? events.length
    : endingIndex >= startIndex ? endingIndex + 1 : events.length
  const rawUnknown = events
    .slice(startIndex, endIndex)
    .filter(event => event?.type === 'tool/result' && event?.data?.error?.code === TOOL_OUTCOME_UNKNOWN)
    .length
  const syntheticUnknown = closers
    .filter(event => event?.data?.error?.code === TOOL_OUTCOME_UNKNOWN)
    .length
  if (closers.length > 0) return rawUnknown + syntheticUnknown
  if (endingIndex < 0 || events[endingIndex]?.data?.reason?.kind !== 'interrupted') return 0
  return rawUnknown
}

function interruptionTime(events, endingIndex, trace) {
  if (endingIndex >= 0 && events[endingIndex]?.data?.reason?.kind === 'interrupted') {
    return events[endingIndex]?.time
  }
  if (trace.openTurn === null) return undefined
  // Ignore title/end-seed records appended after a crashed turn. Only the
  // latest event carrying the open turn identity is its interruption boundary.
  for (let index = events.length - 1; index >= trace.lastTurnStartIndex; index -= 1) {
    if (events[index]?.data?.turn === trace.openTurn || events[index]?.type === 'turn/start') {
      return events[index]?.time
    }
  }
  return undefined
}

/** Return side-effect-free facts used to decide whether a cold session needs recovery. */
export function recoveryFacts(events, { now = Date.now(), maxAgeMs = DEFAULT_RECOVERY_MAX_AGE_MS } = {}) {
  const closers = interruptedTurnClosers(events)
  const endingIndex = lastTurnEndIndex(events)
  const ending = endingIndex < 0 ? undefined : events[endingIndex]
  const trace = executionTrace(events)
  const interrupted = closers.length > 0 || ending?.data?.reason?.kind === 'interrupted'
    || trace.lastTurnEndReason === 'interrupted'
  const lastEventTime = events.at(-1)?.time
  const interruptedAt = interruptionTime(events, endingIndex, trace)
  const ageMs = typeof interruptedAt === 'number' && Number.isFinite(interruptedAt)
    ? Math.max(0, now - interruptedAt)
    : Number.POSITIVE_INFINITY
  const recent = ageMs <= maxAgeMs
  const unknownToolOutcomes = unknownToolOutcomesForTail(events, closers, endingIndex, trace)
  let goal
  let goalError
  try {
    goal = foldGoal(events)
  } catch (error) {
    goalError = error
  }
  return {
    interrupted,
    closers,
    unknownToolOutcomes,
    pendingToolCalls: trace.pendingToolCalls,
    openTurn: trace.openTurn,
    openStep: trace.openStep,
    interruptionTime: interruptedAt,
    lastEventTime,
    ageMs,
    recent,
    goal,
    goalError,
    lastSeq: events.at(-1)?.seq ?? -1,
  }
}

function sameGoal(left, right) {
  return left?.id === right?.id && left?.revision === right?.revision
}

function normalizeGoalView(value) {
  if (value?.id !== undefined) return value
  if (value?.goal !== undefined && typeof value.goal === 'object' && value.goal !== null) {
    return { ...value.goal, ...value }
  }
  return value
}

function sameOpaque(left, right) {
  if (left === undefined || right === undefined) return left === right
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return Object.is(left, right)
  }
}

function agentOptionsFor(ctx) {
  const defaults = service(ctx, 'agentDefaultModel')
  const selection = defaults?.currentSelection?.()
  if (typeof selection?.provider !== 'string' || typeof selection?.model !== 'string') {
    throw new Error('agent default model service is unavailable')
  }
  // Match host-apiproxy: the create/resume factory receives provider/model;
  // reasoning effort is installed by the session-scoped request composition.
  return { provider: selection.provider, model: selection.model }
}

function installModelComposition(ctx, agentCtx) {
  const agent = agentCtx?.agent
  if (agent === undefined || typeof agent.session?.requestHeader !== 'function') {
    throw new Error('agent model composition context is unavailable')
  }
  const defaults = service(ctx, 'agentDefaultModel')
  if (typeof defaults?.currentSelection !== 'function') {
    throw new Error('agent default model service is unavailable')
  }
  let picked
  const selection = {
    get current() {
      if (picked !== undefined) return picked
      const logged = agent.session.requestHeader()?.config
      if (logged === undefined) return defaults.currentSelection()
      return {
        provider: logged.provider,
        model: logged.model,
        ...(logged.reasoningEffort === undefined ? {} : { reasoningEffort: logged.reasoningEffort }),
      }
    },
    set current(next) {
      picked = next
    },
    assembled: undefined,
  }
  return installModelSelection(agentCtx, selection)
}

async function resumeComposition(ctx, meta, events) {
  const presets = service(ctx, 'agentPresets')
  const presetId = resolveSessionPreset({ header: meta, events })
  const composition = presets === undefined
    ? undefined
    : await presets.resolve(presetId)
  return {
    agentOptions: agentOptionsFor(ctx),
    setup: async agentCtx => {
      installModelComposition(ctx, agentCtx)
      if (composition !== undefined) await presets.mount(agentCtx, composition.id)
    },
  }
}

async function revisionFor(persistence, sessionId) {
  if (typeof persistence.listSnapshots !== 'function') return undefined
  const snapshots = await persistence.listSnapshots()
  return snapshots.find(snapshot => snapshot?.header?.id === sessionId)?.revision
}

function liveSession(ctx, sessionId) {
  const sessions = service(ctx, 'sessions')
  const agents = service(ctx, 'agents')
  const session = sessions?.get?.(sessionId)
  const agent = agents?.get?.(sessionId)
  return { session, agent, live: session !== undefined || agent !== undefined }
}

function subagentOwned(ctx, session, agent) {
  if (session?.header === undefined) return true
  try {
    return hasApiRemoteSubagentOwner(ctx, session, agent)
  } catch (error) {
    // An incomplete ownership view is not safe to adopt. The official resolver
    // treats subagent ownership as a hard routing fence, so do the same here.
    log(ctx, 'warn', 'ownership-check-failed', session.header.id, { error: errorType(error) })
    return true
  }
}

async function inspectForResume(ctx, persistence, sessionId, fallback) {
  if (typeof persistence.inspect !== 'function') return fallback
  // Keep the exact API-proxy inspection path when the Host Context is present;
  // it validates the project-backed identity and returns the immutable logical
  // view used by preset reconstruction. The fallback only supports minimal
  // test/legacy contexts that expose the same persistence API without get().
  if (typeof ctx?.get === 'function') return inspectApiRemoteSession(ctx, sessionId)
  const inspected = await persistence.inspect(sessionId)
  return { meta: inspected.meta, events: [...inspected.events] }
}

async function waitIdleAndFlush(ctx, agent) {
  if (typeof agent?.whenIdle !== 'function') throw new Error('agent idle barrier is unavailable')
  await agent.whenIdle()
  if (agent.status !== 'idle') throw new Error('agent did not reach idle')
  const agents = service(ctx, 'agents')
  if (agents?.get?.(agent.id) !== agent) throw new Error('resumed agent was replaced before recovery')
  const sessions = service(ctx, 'sessions')
  if (typeof sessions?.flush !== 'function') throw new Error('session store flush is unavailable')
  if (typeof sessions.get === 'function' && sessions.get(agent.id) !== agent.session) {
    throw new Error('resumed session was replaced before recovery')
  }
  await sessions.flush(agent.session)
  if (agents.get(agent.id) !== agent
    || (typeof sessions.get === 'function' && sessions.get(agent.id) !== agent.session)) {
    throw new Error('agent changed while recovery state was being flushed')
  }
}

async function reconcileProjection(ctx, meta, lastSeq, logger) {
  const cache = service(ctx, 'sessionProjectionCache')
  if (typeof cache?.coldSnapshot !== 'function') return
  let cached
  try {
    cached = cache.cachedSnapshot?.(meta)
  } catch (error) {
    log(ctx, 'warn', 'projection-cache-read-failed', meta.id, { error: errorType(error) })
  }
  if (cached?.asOfSeq === lastSeq) return
  try {
    await cache.coldSnapshot(meta.id)
    log(ctx, 'info', 'projection-cache-reconciled', meta.id, { asOfSeq: lastSeq })
  } catch (error) {
    // Projection cache is a read optimization. A failure must not prevent the
    // official agent resume path from repairing a session log.
    logger?.('projection-cache-reconcile-failed', meta.id, error)
  }
}

export class SessionRecoveryCoordinator {
  constructor(ctx, {
    enabled = true,
    delayMs = DEFAULT_RECOVERY_DELAY_MS,
    staleAfterMs = DEFAULT_RECOVERY_LOCK_STALE_MS,
    maxAgeMs = DEFAULT_RECOVERY_MAX_AGE_MS,
    now = Date.now,
    leasePath,
    claimStore = service(ctx, 'recoveryClaimStore'),
  } = {}) {
    this.ctx = ctx
    this.enabled = typeof enabled === 'function' ? enabled : () => enabled !== false
    this.delayMs = delayMs
    this.staleAfterMs = staleAfterMs
    this.maxAgeMs = maxAgeMs
    this.now = typeof now === 'function' ? now : () => now
    this.leasePath = leasePath
    this.claimStore = claimStore
    this.timer = undefined
    this.running = undefined
    this.disposed = false
    this.started = false
    this.dirty = false
    this.attempted = new Set()
    this.handles = new Map()
  }

  setEnabled(value) {
    this.enabled = typeof value === 'function' ? value : () => value !== false
    if (!this.started || this.disposed) return
    if (this.isEnabled()) this.schedule()
    else if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }

  isEnabled() {
    try {
      return this.enabled() !== false
    } catch {
      return false
    }
  }

  start() {
    if (this.disposed) return
    this.started = true
    this.schedule()
  }

  schedule() {
    if (!this.started || this.disposed || !this.isEnabled() || this.timer !== undefined) return
    if (this.running !== undefined) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.reconcile().catch(error => {
        log(this.ctx, 'warn', 'reconcile-failed', undefined, { error: errorType(error) })
      })
    }, this.delayMs)
    this.timer.unref?.()
  }

  async reconcile() {
    if (this.disposed || !this.isEnabled()) return { skipped: 'disabled' }
    if (this.running !== undefined) return this.running
    this.dirty = false
    this.running = this.reconcileOnce().finally(() => {
      this.running = undefined
      if (this.dirty && this.isEnabled()) this.schedule()
    })
    return this.running
  }

  observeEvent(event) {
    if (event?.type !== 'turn/end' || event.data?.reason?.kind !== 'interrupted') return
    if (!this.isEnabled()) return
    this.dirty = true
    this.schedule()
  }

  async reconcileOnce() {
    const persistence = service(this.ctx, 'sessionPersistence')
    const agents = service(this.ctx, 'agents')
    if (typeof persistence?.list !== 'function' || typeof persistence?.readFrom !== 'function') {
      log(this.ctx, 'warn', 'services-unavailable', undefined)
      return { skipped: 'services-unavailable' }
    }
    if (typeof agents?.resume !== 'function') {
      log(this.ctx, 'warn', 'agent-service-unavailable', undefined)
      return { skipped: 'agent-service-unavailable' }
    }

    const leasePath = this.leasePath
    if (typeof leasePath !== 'string' || leasePath.length === 0) {
      log(this.ctx, 'warn', 'lease-path-unavailable', undefined)
      return { skipped: 'lease-path-unavailable' }
    }
    const lease = await acquireRecoveryLease(leasePath, { staleAfterMs: this.staleAfterMs })
    if (lease === undefined) {
      log(this.ctx, 'info', 'lease-busy', undefined)
      return { skipped: 'lease-busy' }
    }

    const result = { reconciled: 0, resumed: 0, skipped: 0 }
    try {
      const headers = await persistence.list()
      for (const meta of headers) {
        if (this.disposed || !this.isEnabled()) break
        if (typeof meta?.id !== 'string') continue
        const initial = liveSession(this.ctx, meta.id)
        if (initial.live) {
          const liveIdentity = initial.session ?? initial.agent?.session
          if (subagentOwned(this.ctx, liveIdentity, initial.agent)) {
            result.skipped += 1
            log(this.ctx, 'info', 'subagent-owned-skipped', meta.id)
            continue
          }
          await this.reconcileLive(meta, initial, result)
          continue
        }
        if (subagentOwned(this.ctx, { header: meta }, undefined)) {
          result.skipped += 1
          log(this.ctx, 'info', 'subagent-owned-skipped', meta.id)
          continue
        }

        let raw
        let initialRevision
        try {
          raw = await persistence.readFrom(meta.id, 0)
          initialRevision = await revisionFor(persistence, meta.id)
        } catch (error) {
          result.skipped += 1
          log(this.ctx, 'warn', 'raw-read-failed', meta.id, { error: errorType(error) })
          continue
        }
        const becameLive = liveSession(this.ctx, meta.id)
        if (becameLive.live) {
          const liveIdentity = becameLive.session ?? becameLive.agent?.session
          if (subagentOwned(this.ctx, liveIdentity, becameLive.agent)) {
            result.skipped += 1
            log(this.ctx, 'info', 'subagent-owned-skipped', meta.id)
            continue
          }
          await this.reconcileLive(meta, becameLive, result)
          continue
        }
        const facts = recoveryFacts(raw.events ?? [], { now: this.now(), maxAgeMs: this.maxAgeMs })
        await reconcileProjection(this.ctx, meta, facts.lastSeq, (code, id, error) => {
          log(this.ctx, 'warn', code, id, { error: errorType(error) })
        })
        result.reconciled += 1
        if (!facts.interrupted || !facts.recent || facts.goalError !== undefined || facts.goal?.goal?.phase !== 'active') {
          result.skipped += 1
          if (facts.goalError !== undefined) log(this.ctx, 'warn', 'goal-fold-failed', meta.id, { error: errorType(facts.goalError) })
          else if (facts.interrupted && !facts.recent) log(this.ctx, 'info', 'old-interruption-skipped', meta.id, { ageMs: facts.ageMs })
          continue
        }
        const expected = facts.goal.goal
        if (facts.goal.roundsStarted >= expected.maxGoalRounds) {
          result.skipped += 1
          log(this.ctx, 'info', 'goal-budget-exhausted', meta.id, { rounds: facts.goal.roundsStarted, max: expected.maxGoalRounds })
          continue
        }
        if (typeof this.claimStore?.allows !== 'function') {
          result.skipped += 1
          log(this.ctx, 'warn', 'claim-store-unavailable', meta.id)
          continue
        }
        let claimed
        try {
          claimed = await this.claimStore.allows(meta.id, expected, meta)
        } catch (error) {
          result.skipped += 1
          log(this.ctx, 'warn', 'claim-store-read-failed', meta.id, { error: errorType(error) })
          continue
        }
        if (!claimed) {
          result.skipped += 1
          log(this.ctx, 'info', 'unclaimed-goal-skipped', meta.id)
          continue
        }
        const attemptKey = `${meta.id}:${facts.lastSeq}:${expected.id}:${expected.revision}`
        if (this.attempted.has(attemptKey)) {
          result.skipped += 1
          log(this.ctx, 'debug', 'duplicate-recovery-skipped', meta.id)
          continue
        }
        this.attempted.add(attemptKey)
        await this.recoverGoal(meta.id, expected, facts, result, attemptKey, initialRevision, raw.meta ?? meta)
      }
      return result
    } finally {
      await lease.release().catch(error => {
        log(this.ctx, 'warn', 'lease-release-failed', undefined, { error: errorType(error) })
      })
    }
  }

  async reconcileLive(meta, initial, result) {
    const agent = initial.agent
    const session = initial.session ?? agent?.session
    const status = agent?.status
    if (subagentOwned(this.ctx, session, agent)) {
      result.skipped += 1
      log(this.ctx, 'info', 'subagent-owned-skipped', meta.id)
      return
    }
    const liveEvents = Array.isArray(session?.events) ? session.events : []
    const liveFacts = recoveryFacts(liveEvents, { now: this.now(), maxAgeMs: this.maxAgeMs })
    log(this.ctx, 'debug', 'live-session-state', meta.id, {
      status: status ?? 'unknown',
      openStep: liveFacts.openStep === null ? false : true,
      pendingCalls: liveFacts.pendingToolCalls,
    })
    if (status === 'running') {
      result.skipped += 1
      log(this.ctx, 'debug', 'live-running-skipped', meta.id, { status })
      return
    }
    if (status !== 'idle' || agent === undefined || session === undefined) {
      result.skipped += 1
      log(this.ctx, 'debug', 'live-state-skipped', meta.id, { status: status ?? 'unknown' })
      return
    }
    const persistence = service(this.ctx, 'sessionPersistence')
    let raw
    try {
      raw = await persistence.readFrom(meta.id, 0)
    } catch (error) {
      result.skipped += 1
      log(this.ctx, 'warn', 'live-raw-read-failed', meta.id, { error: errorType(error) })
      return
    }
    const physicalFacts = recoveryFacts(raw.events ?? [], { now: this.now(), maxAgeMs: this.maxAgeMs })
    const liveSeq = liveFacts.lastSeq >= 0 ? liveFacts.lastSeq : (session.seq ?? 0) - 1
    log(this.ctx, 'debug', 'live-session-reconciled', meta.id, {
      status,
      openStep: liveFacts.openStep === null ? false : true,
      pendingCalls: liveFacts.pendingToolCalls,
      liveSeq,
      physicalSeq: physicalFacts.lastSeq,
    })
    if (liveSeq !== physicalFacts.lastSeq) {
      // Idle agents may still have a buffered tail. Flush only the exact live
      // session; never replace it with a second Agent or resume a running one.
      try {
        await service(this.ctx, 'sessions').flush(session)
      } catch (error) {
        log(this.ctx, 'warn', 'live-flush-failed', meta.id, { error: errorType(error) })
      }
      result.skipped += 1
      return
    }
    if (liveFacts.openStep !== null || liveFacts.pendingToolCalls > 0) {
      result.skipped += 1
      log(this.ctx, 'info', 'live-open-work-skipped', meta.id, {
        openStep: liveFacts.openStep === null ? false : true,
        pendingCalls: liveFacts.pendingToolCalls,
      })
      return
    }
    if (!liveFacts.interrupted || !liveFacts.recent || liveFacts.goalError !== undefined
      || liveFacts.goal?.goal?.phase !== 'active') {
      result.skipped += 1
      return
    }
    const expected = liveFacts.goal.goal
    if (liveFacts.goal.roundsStarted >= expected.maxGoalRounds) {
      result.skipped += 1
      log(this.ctx, 'info', 'goal-budget-exhausted', meta.id, {
        rounds: liveFacts.goal.roundsStarted,
        max: expected.maxGoalRounds,
      })
      return
    }
    if (typeof this.claimStore?.allows !== 'function') {
      result.skipped += 1
      log(this.ctx, 'warn', 'claim-store-unavailable', meta.id)
      return
    }
    try {
      if (!(await this.claimStore.allows(meta.id, expected, session.header ?? meta))) {
        result.skipped += 1
        log(this.ctx, 'info', 'unclaimed-goal-skipped', meta.id)
        return
      }
    } catch (error) {
      result.skipped += 1
      log(this.ctx, 'warn', 'claim-store-read-failed', meta.id, { error: errorType(error) })
      return
    }
    const attemptKey = `${meta.id}:${liveFacts.lastSeq}:${expected.id}:${expected.revision}`
    if (this.attempted.has(attemptKey)) {
      result.skipped += 1
      return
    }
    this.attempted.add(attemptKey)
    try {
      await waitIdleAndFlush(this.ctx, agent)
      await this.resumeGoalOnAgent(meta.id, expected, liveFacts, result, agent, session.header ?? meta)
    } catch (error) {
      result.skipped += 1
      log(this.ctx, 'warn', 'live-recovery-failed', meta.id, { error: errorType(error) })
      this.attempted.delete(attemptKey)
    }
  }

  async resumeGoalOnAgent(sessionId, expected, facts, result, agent, lifecycle) {
    if (this.disposed || !this.isEnabled()) return
    const goals = goalServiceFor(this.ctx, agent)
    if (typeof goals?.get !== 'function' || typeof goals?.resume !== 'function') {
      result.skipped += 1
      log(this.ctx, 'warn', 'goal-services-unavailable', sessionId)
      return
    }
    const current = normalizeGoalView(goals.get(agent))
    if (!sameGoal(current, expected) || current.phase !== 'active') {
      result.skipped += 1
      log(this.ctx, 'info', 'goal-changed-before-resume', sessionId)
      return
    }
    if (current.roundsStarted >= current.maxGoalRounds) {
      result.skipped += 1
      log(this.ctx, 'info', 'goal-budget-exhausted', sessionId, { rounds: current.roundsStarted, max: current.maxGoalRounds })
      return
    }
    if (facts.unknownToolOutcomes > 0 || facts.pendingToolCalls > 0) {
      // The official persistence repair has already materialized the
      // TOOL_OUTCOME_UNKNOWN result. Do not arm a goal round: a model must
      // verify side effects externally before any retry is considered.
      result.skipped += 1
      log(this.ctx, 'warn', 'unknown-tool-outcome-manual-check', sessionId, {
        count: facts.unknownToolOutcomes,
        pendingCalls: facts.pendingToolCalls,
      })
      return
    }
    if (!(await this.claimStore.allows(sessionId, current, lifecycle ?? agent.session.header))) {
      result.skipped += 1
      log(this.ctx, 'info', 'claim-revoked-before-resume', sessionId)
      return
    }
    // goals.resume() is intentionally the final mutation. The native
    // goal-round-driver observes its durable activation and admits one
    // ordinary follow-up; this plugin never sends a synthetic user prompt.
    goals.resume(agent, { id: current.id, revision: current.revision })
    await service(this.ctx, 'sessions').flush(agent.session)
    result.resumed += 1
    log(this.ctx, 'info', 'goal-resumed', sessionId, { goalRevision: current.revision, unknownToolOutcomes: facts.unknownToolOutcomes })
  }

  async recoverGoal(sessionId, expected, facts, result, attemptKey, initialRevision, sourceMeta) {
    const agents = service(this.ctx, 'agents')
    const persistence = service(this.ctx, 'sessionPersistence')
    const becameLive = liveSession(this.ctx, sessionId)
    if (becameLive.live) {
      if (subagentOwned(this.ctx, becameLive.session ?? becameLive.agent?.session, becameLive.agent)) {
        result.skipped += 1
        log(this.ctx, 'info', 'subagent-owned-skipped', sessionId)
        return
      }
      await this.reconcileLive(sourceMeta ?? { id: sessionId }, becameLive, result)
      return
    }
    let latestFacts
    let latestEvents = []
    let latestMeta = sourceMeta
    try {
      // Re-check the physical source after acquiring the lease and immediately
      // before resume. A concurrent writer or another Harness process must not
      // be resumed against the observations used for this decision.
      const latest = await persistence.readFrom(sessionId, 0)
      latestMeta = latest.meta ?? sourceMeta
      latestEvents = latest.events ?? []
      latestFacts = recoveryFacts(latestEvents, { now: this.now(), maxAgeMs: this.maxAgeMs })
      const latestRevision = await revisionFor(persistence, sessionId)
      if (latestFacts.lastSeq !== facts.lastSeq
        || !latestFacts.interrupted
        || !latestFacts.recent
        || !sameGoal(latestFacts.goal?.goal, expected)
        || !sameOpaque(initialRevision, latestRevision)) {
        result.skipped += 1
        log(this.ctx, 'info', 'physical-state-changed', sessionId)
        this.attempted.delete(attemptKey)
        return
      }
    } catch (error) {
      result.skipped += 1
      log(this.ctx, 'warn', 'physical-recheck-failed', sessionId, { error: errorType(error) })
      this.attempted.delete(attemptKey)
      return
    }
    let handle
    try {
      // Match the official api-proxy resolver: inspect the immutable session,
      // fence subagent ownership, then compose its recorded preset before the
      // Agent registry performs the only persistence repair/resume operation.
      const inspected = await inspectForResume(this.ctx, persistence, sessionId, {
        meta: latestMeta,
        events: latestEvents,
      })
      if (subagentOwned(this.ctx, { header: inspected.meta }, undefined)) {
        result.skipped += 1
        log(this.ctx, 'info', 'subagent-owned-skipped', sessionId)
        return
      }
      const composition = await resumeComposition(this.ctx, inspected.meta, inspected.events)

      // Preset resolution/setup can await filesystem work. Re-read the physical
      // source immediately before publication so a write during that window
      // cannot be resumed against an older tail or revision token.
      const final = await persistence.readFrom(sessionId, 0)
      const finalRevision = await revisionFor(persistence, sessionId)
      const finalFacts = recoveryFacts(final.events ?? [], { now: this.now(), maxAgeMs: this.maxAgeMs })
      if (subagentOwned(this.ctx, { header: final.meta }, undefined)) {
        result.skipped += 1
        log(this.ctx, 'info', 'subagent-owned-skipped', sessionId)
        this.attempted.delete(attemptKey)
        return
      }
      if (finalFacts.lastSeq !== latestFacts.lastSeq
        || !finalFacts.interrupted
        || !finalFacts.recent
        || !sameGoal(finalFacts.goal?.goal, expected)
        || !sameOpaque(latestFacts.goal?.goal, finalFacts.goal?.goal)
        || !sameOpaque(initialRevision, finalRevision)
        || !sameLifecycle(sessionLifecycle(final.meta), sessionLifecycle(inspected.meta))) {
        result.skipped += 1
        log(this.ctx, 'info', 'physical-state-changed', sessionId)
        this.attempted.delete(attemptKey)
        return
      }
      latestFacts = finalFacts
      latestMeta = final.meta ?? latestMeta
      const published = liveSession(this.ctx, sessionId)
      if (published.live) {
        if (subagentOwned(this.ctx, published.session ?? published.agent?.session, published.agent)) {
          result.skipped += 1
          log(this.ctx, 'info', 'subagent-owned-skipped', sessionId)
        } else {
          result.skipped += 1
          log(this.ctx, 'debug', 'became-live-before-resume', sessionId)
        }
        return
      }

      // This is the only cold-session activation path. The official DSH agent
      // registry performs persistence repair; no old message or tool event is
      // replayed by this plugin.
      handle = await agents.resume({
        resumeSessionId: sessionId,
        agentOptions: composition.agentOptions,
        setup: composition.setup,
      })
      const agent = handle?.agent
      if (typeof handle?.dispose !== 'function' || agent === undefined
        || agent.id !== sessionId || agent.session?.id !== sessionId) {
        throw new Error('resume returned no matching agent')
      }
      this.handles.set(sessionId, handle)
      await waitIdleAndFlush(this.ctx, agent)
      await this.resumeGoalOnAgent(sessionId, expected, latestFacts, result, agent, latestMeta)
    } catch (error) {
      result.skipped += 1
      log(this.ctx, 'warn', 'recovery-failed', sessionId, { error: errorType(error) })
      if (typeof handle?.dispose === 'function' && !this.handles.has(sessionId)) {
        await handle.dispose().catch(disposeError => {
          log(this.ctx, 'warn', 'recovery-handle-cleanup-failed', sessionId, { error: errorType(disposeError) })
        })
      }
      if (!this.handles.has(sessionId)) this.attempted.delete(attemptKey)
    }
  }

  async dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    await this.running?.catch(() => {})
    const handles = [...this.handles.values()]
    this.handles.clear()
    await Promise.all(handles.map(async handle => {
      try {
        await handle.dispose?.()
      } catch (error) {
        log(this.ctx, 'warn', 'recovery-handle-dispose-failed', undefined, { error: errorType(error) })
      }
    }))
  }
}
