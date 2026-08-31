import assert from 'node:assert/strict'
import { rm, stat, utimes, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { acquireRecoveryLease, recoveryFacts, RecoveryClaimStore, SessionRecoveryCoordinator } from '../lib/recovery.js'

const roots = []
const BASE_TIME = Date.now()

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function goalChange({ phase = 'active', maxGoalRounds = 3, roundsStarted = 0, revision = 1 } = {}) {
  return {
    kind: 'goal/change',
    version: 1,
    operation: revision === 1 ? 'create' : phase === 'complete' ? 'complete' : phase === 'blocked' ? 'block' : 'edit',
    goal: {
      id: 'goal-recovery-1',
      revision,
      objective: '继续验证构建结果',
      phase,
      maxGoalRounds,
      ...(phase === 'blocked' ? { blockedReason: { code: 'test', message: '测试阻断' } } : {}),
    },
    roundsStarted,
    createdAt: 1,
    updatedAt: revision,
  }
}

function event(type, seq, data) {
  return { type, seq, time: BASE_TIME + seq, data }
}

async function waitFor(predicate, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for recovery test condition')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

function interruptedEvents({ balanced = false, unknownTool = false, goal = {} } = {}) {
  const events = [event('goal/change', 0, goalChange({ maxGoalRounds: goal.maxGoalRounds ?? 3 }))]
  let nextSeq = 1
  if (goal.phase === 'complete' || goal.phase === 'blocked') {
    events.push(event('goal/change', nextSeq++, goalChange({
      phase: goal.phase,
      maxGoalRounds: goal.maxGoalRounds ?? 3,
      revision: 2,
    })))
  }
  if ((goal.roundsStarted ?? 0) > 0) {
    events.push(event('user/message', nextSeq++, {
      source: { kind: 'goal', goalId: 'goal-recovery-1', revision: 1, round: 1 },
    }))
  }
  events.push(event('turn/start', nextSeq++, { turn: 1 }))
  events.push(event('step/start', nextSeq++, { turn: 1, step: 1 }))
  if (unknownTool) {
    events.push(event('assistant/message', nextSeq++, {
      turn: 1,
      step: 1,
      message: { id: 'assistant-1', role: 'assistant', content: [{ type: 'tool-call', id: 'call-1', name: 'Bash', arguments: {} }] },
    }))
    events.push(event('tool/call', nextSeq++, { turn: 1, step: 1, callId: 'call-1' }))
  }
  if (balanced) events.push(event('turn/end', nextSeq, { turn: 1, reason: { kind: 'interrupted' } }))
  return events
}

function makeContext(root, events, {
  live = false,
  cacheAsOfSeq,
  goalView,
  revision = 'revision-1',
  origin,
  parentSession,
  ownedBy = false,
} = {}) {
  const sessionId = 'session-recovery-1'
  const meta = {
    id: sessionId,
    cwd: root,
    version: 0,
    createdAt: 1,
    agentPreset: 'test-preset',
    ...(origin === undefined ? {} : { origin }),
    ...(parentSession === undefined ? {} : { parentSession }),
  }
  const liveAgents = new Map()
  let readCount = 0
  let cacheReconciled = 0
  let flushCount = 0
  let resumeCount = 0
  let inspectCount = 0
  let goalResumeCount = 0
  let presetMountCount = 0
  let resumeOptions
  const sessions = {
    get: id => liveAgents.get(id)?.session,
    flush: async () => { flushCount += 1 },
  }
  const agents = {
    get: id => liveAgents.get(id),
    isOwnedBy: () => ownedBy,
    async resume(options) {
      const { resumeSessionId } = options
      resumeCount += 1
      const agent = {
        id: resumeSessionId,
        status: 'idle',
      session: {
        id: resumeSessionId,
        header: meta,
        seq: events.at(-1)?.seq ?? -1,
          events,
          requestHeader: () => undefined,
        },
        async whenIdle() {},
      }
      resumeOptions = options
      await options.setup?.({ agent, on: () => () => {} })
      liveAgents.set(resumeSessionId, agent)
      return { agent, async dispose() { liveAgents.delete(resumeSessionId) } }
    },
  }
  if (live) {
    const agent = {
      id: sessionId,
      status: 'idle',
      session: {
        id: sessionId,
        header: meta,
        seq: events.at(-1)?.seq ?? -1,
        events,
        requestHeader: () => undefined,
      },
      whenIdle: async () => {},
    }
    liveAgents.set(sessionId, agent)
    if (parentSession !== undefined) liveAgents.set(parentSession, { id: parentSession })
  }
  const currentGoal = goalView ?? {
    ...goalChange().goal,
    roundsStarted: 0,
    createdAt: 1,
    updatedAt: 1,
    activation: 'disarmed',
  }
  const goals = {
    get: () => currentGoal,
    resume: (_agent, ref) => {
      goalResumeCount += 1
      return { ...currentGoal, id: ref.id, revision: ref.revision + 1, activation: 'armed' }
    },
  }
  const agentPresets = {
    async resolve(id) { return { id: id ?? 'test-preset' } },
    async mount() { presetMountCount += 1 },
    serviceFor: () => goals,
  }
  const agentDefaultModel = {
    currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }),
  }
  const recoveryClaimStore = { allows: async () => true }
  const persistence = {
    async list() { return [meta] },
    async inspect() {
      inspectCount += 1
      return { meta, events }
    },
    async readFrom() {
      readCount += 1
      return { meta, events }
    },
    async listSnapshots() { return [{ header: meta, revision }] },
  }
  const cache = {
    cachedSnapshot: () => cacheAsOfSeq === undefined ? undefined : { asOfSeq: cacheAsOfSeq, values: {} },
    async coldSnapshot() { cacheReconciled += 1 },
  }
  const logs = []
  const ctx = {
    sessions,
    agents,
    goals,
    agentPresets,
    agentDefaultModel,
    recoveryClaimStore,
    sessionPersistence: persistence,
    sessionProjectionCache: cache,
    get(name) { return this[name] },
    logger: { info: message => logs.push(message), warn: message => logs.push(message), debug: message => logs.push(message) },
  }
  return {
    ctx,
    id: sessionId,
    logs,
    get readCount() { return readCount },
    get cacheReconciled() { return cacheReconciled },
    get flushCount() { return flushCount },
    get resumeCount() { return resumeCount },
    get inspectCount() { return inspectCount },
    get goalResumeCount() { return goalResumeCount },
    get presetMountCount() { return presetMountCount },
    get resumeOptions() { return resumeOptions },
  }
}

test('recovery facts identify a balanced interrupted turn and active goal', () => {
  const facts = recoveryFacts(interruptedEvents({ balanced: true }), { now: BASE_TIME + 100 })
  assert.equal(facts.interrupted, true)
  assert.equal(facts.closers.length, 0)
  assert.equal(facts.goal.goal.phase, 'active')
  assert.equal(facts.unknownToolOutcomes, 0)
})

test('uses the interrupted boundary rather than trailing metadata for age', () => {
  const events = interruptedEvents({ balanced: true })
  events.push(event('session/title', 4, { title: 'late title' }))
  events.push(event('session/end-seed', 5, {}))
  const facts = recoveryFacts(events, { now: BASE_TIME + 2003, maxAgeMs: 100 })
  assert.equal(facts.interruptionTime, BASE_TIME + 3)
  assert.equal(facts.ageMs, 2000)
  assert.equal(facts.recent, false)
})

test('detects a pending durable tool call even without an assistant closer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-pending-call-'))
  roots.push(root)
  const events = interruptedEvents()
  events.push(event('tool/call', 3, { turn: 1, step: 1, callId: 'call-without-closer' }))
  const facts = recoveryFacts(events, { now: BASE_TIME + 100 })
  assert.equal(facts.pendingToolCalls, 1)
  assert.equal(facts.unknownToolOutcomes, 0)
  const f = makeContext(root, events, { cacheAsOfSeq: 3 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 1)
  assert.equal(f.inspectCount, 1)
  assert.equal(f.goalResumeCount, 0)
  assert.match(f.logs.join('\n'), /unknown-tool-outcome-manual-check/)
})

test('only the latest interrupted turn can block recovery for an unknown tool outcome', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-unknown-history-'))
  roots.push(root)
  const events = [
    event('goal/change', 0, goalChange()),
    event('turn/start', 1, { turn: 1 }),
    event('step/start', 2, { turn: 1, step: 1 }),
    event('tool/result', 3, {
      turn: 1,
      step: 1,
      message: { source: { callId: 'call-1' } },
      error: { code: 'TOOL_OUTCOME_UNKNOWN' },
    }),
    event('step/end', 4, { turn: 1, step: 1 }),
    event('turn/end', 5, { turn: 1, reason: { kind: 'interrupted' } }),
    event('turn/start', 6, { turn: 2 }),
    event('step/start', 7, { turn: 2, step: 1 }),
    event('step/end', 8, { turn: 2, step: 1 }),
    event('turn/end', 9, { turn: 2, reason: { kind: 'complete' } }),
    event('turn/start', 10, { turn: 3 }),
    event('step/start', 11, { turn: 3, step: 1 }),
    event('turn/end', 12, { turn: 3, reason: { kind: 'interrupted' } }),
  ]
  const facts = recoveryFacts(events, { now: BASE_TIME + 100 })
  assert.equal(facts.interrupted, true)
  assert.equal(facts.unknownToolOutcomes, 0)
  const f = makeContext(root, events, { cacheAsOfSeq: 12 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 1)
  assert.equal(f.goalResumeCount, 1)
  assert.equal(f.presetMountCount, 1)
  assert.equal(f.resumeOptions.agentOptions.provider, 'test-provider')
  assert.equal(f.resumeOptions.agentOptions.model, 'test-model')
  assert.equal(typeof f.resumeOptions.setup, 'function')
})

test('does not revive an old interrupted goal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-old-'))
  roots.push(root)
  const events = interruptedEvents({ balanced: true }).map(event => ({ ...event, time: BASE_TIME - 2 * 24 * 60 * 60 * 1000 }))
  const f = makeContext(root, events, { cacheAsOfSeq: 3 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, {
    leasePath: join(root, 'recovery.lock'),
    now: BASE_TIME,
    maxAgeMs: 24 * 60 * 60 * 1000,
  })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.match(f.logs.join('\n'), /old-interruption-skipped/)
})

test('does not revive a historical active goal without a durable claim', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-unclaimed-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents({ balanced: true }), { cacheAsOfSeq: 3 })
  f.ctx.recoveryClaimStore = { allows: async () => false }
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.match(f.logs.join('\n'), /unclaimed-goal-skipped/)
})

test('does not adopt a cold subagent-owned session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-subagent-cold-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents({ balanced: true }), { origin: 'subagent' })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.equal(f.readCount, 0)
  assert.match(f.logs.join('\n'), /subagent-owned-skipped/)
})

test('does not adopt a live agent owned by subagent routing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-subagent-live-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents({ balanced: true }), {
    live: true,
    parentSession: 'parent-session',
    ownedBy: true,
  })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.equal(f.goalResumeCount, 0)
  assert.match(f.logs.join('\n'), /subagent-owned-skipped/)
})

test('schedules recovery for a runtime interrupted turn, not ordinary events', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-runtime-event-'))
  roots.push(root)
  const events = [event('turn/end', 0, { turn: 0, reason: { kind: 'complete' } })]
  const f = makeContext(root, events, { cacheAsOfSeq: 0 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, {
    leasePath: join(root, 'recovery.lock'),
    delayMs: 5,
  })
  let runs = 0
  const reconcile = coordinator.reconcile.bind(coordinator)
  coordinator.reconcile = async (...args) => {
    runs += 1
    return reconcile(...args)
  }
  coordinator.start()
  await waitFor(() => runs >= 1 && coordinator.running === undefined)
  assert.equal(runs, 1)

  coordinator.observeEvent({ type: 'assistant/chunk', data: {} })
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(runs, 1)

  events.push(
    event('goal/change', 1, goalChange()),
    event('turn/start', 2, { turn: 1 }),
    event('step/start', 3, { turn: 1, step: 1 }),
    event('turn/end', 4, { turn: 1, reason: { kind: 'interrupted' } }),
  )
  coordinator.observeEvent(events.at(-1))
  await waitFor(() => runs >= 2 && coordinator.running === undefined)
  await coordinator.dispose()
  assert.equal(f.resumeCount, 1)
  assert.equal(f.goalResumeCount, 1)
})

test('reschedules once when an interrupted event arrives during reconciliation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-runtime-race-'))
  roots.push(root)
  const events = interruptedEvents({ balanced: true })
  const f = makeContext(root, events, { cacheAsOfSeq: 3 })
  const entered = Promise.withResolvers()
  const release = Promise.withResolvers()
  const originalInspect = f.ctx.sessionPersistence.inspect
  let inspectCalls = 0
  f.ctx.sessionPersistence.inspect = async (...args) => {
    inspectCalls += 1
    if (inspectCalls === 1) {
      entered.resolve()
      await release.promise
    }
    return originalInspect(...args)
  }
  const coordinator = new SessionRecoveryCoordinator(f.ctx, {
    leasePath: join(root, 'recovery.lock'),
    delayMs: 5,
  })
  let runs = 0
  const reconcile = coordinator.reconcile.bind(coordinator)
  coordinator.reconcile = async (...args) => {
    runs += 1
    return reconcile(...args)
  }
  coordinator.start()
  await entered.promise
  events.push(
    event('turn/start', 4, { turn: 2 }),
    event('step/start', 5, { turn: 2, step: 1 }),
    event('turn/end', 6, { turn: 2, reason: { kind: 'interrupted' } }),
  )
  coordinator.observeEvent(events.at(-1))
  release.resolve()
  await waitFor(() => runs >= 2)
  await coordinator.dispose()
  assert.equal(runs, 2)
  assert.equal(f.resumeCount, 1)
  assert.equal(f.goalResumeCount, 1)
})

test('persists exact unattended claims and rejects other goal revisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-claims-'))
  roots.push(root)
  const location = join(root, 'claims.json')
  const first = new RecoveryClaimStore(location)
  const lifecycle = { createdAt: 10, cwd: root }
  await first.claim('session-1', 'goal-1', 2, lifecycle)
  assert.equal(await first.allows('session-1', { id: 'goal-1', revision: 2 }, lifecycle), true)
  assert.equal(await first.allows('session-1', { id: 'goal-1', revision: 1 }, lifecycle), false)
  assert.equal(await first.allows('session-1', { id: 'goal-1', revision: 2 }, { createdAt: 11, cwd: root }), false)
  await first.dispose()
  const second = new RecoveryClaimStore(location)
  assert.equal(await second.allows('session-1', { id: 'goal-1', revision: 2 }, lifecycle), true)
  await second.revoke('session-1')
  assert.equal(await second.allows('session-1', { id: 'goal-1', revision: 2 }, lifecycle), false)
  await second.dispose()
})

test('records claims only for goal create or explicit resume while enabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-claim-events-'))
  roots.push(root)
  const location = join(root, 'claims.json')
  const store = new RecoveryClaimStore(location)
  store.observe({ id: 'session-1', header: { createdAt: 10, cwd: root } }, {
    type: 'goal/change',
    data: {
      operation: 'create',
      goal: { id: 'goal-1', revision: 1 },
    },
  }, true)
  store.observe({ id: 'session-2', header: { createdAt: 10, cwd: root } }, {
    type: 'goal/change',
    data: {
      operation: 'create',
      goal: { id: 'goal-2', revision: 1 },
    },
  }, false)
  await store.dispose()
  const loaded = new RecoveryClaimStore(location)
  const lifecycle = { createdAt: 10, cwd: root }
  assert.equal(await loaded.allows('session-1', { id: 'goal-1', revision: 1 }, lifecycle), true)
  assert.equal(await loaded.allows('session-2', { id: 'goal-2', revision: 1 }, lifecycle), false)
  await loaded.dispose()
})

test('reconciles a stale cache without activating a balanced non-goal session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-cache-'))
  roots.push(root)
  const events = [event('turn/end', 4, { turn: 1, reason: { kind: 'complete' } })]
  const f = makeContext(root, events, { cacheAsOfSeq: 1 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.reconciled, 1)
  assert.equal(result.resumed, 0)
  assert.equal(f.cacheReconciled, 1)
  assert.equal(f.resumeCount, 0)
})

test('skips a live session even when its persisted tail is interrupted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-live-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents(), { live: true })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.equal(f.readCount, 1)
})

test('reconciles an idle live agent without taking over its identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-live-idle-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents({ balanced: true }), { live: true, cacheAsOfSeq: 3 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 1)
  assert.equal(f.resumeCount, 0)
  assert.equal(f.goalResumeCount, 1)
  assert.equal(f.flushCount, 2)
})

test('resumes one active goal through official APIs and does not send a synthetic prompt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-goal-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents(), { cacheAsOfSeq: 4 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  assert.equal(result.resumed, 1)
  assert.equal(f.resumeCount, 1)
  assert.equal(f.inspectCount, 1)
  assert.equal(f.goalResumeCount, 1)
  assert.equal(f.flushCount, 2)
  assert.equal(f.logs.some(message => message.includes('followup')), false)
  const duplicate = await coordinator.reconcile()
  assert.equal(duplicate.resumed, 0)
  assert.equal(f.resumeCount, 1)
  await coordinator.dispose()
})

test('repairs unknown tool outcome but fail-closes before automatic goal continuation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-unknown-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents({ unknownTool: true }), { cacheAsOfSeq: 0 })
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 1)
  assert.equal(f.goalResumeCount, 0)
  assert.match(f.logs.join('\n'), /unknown-tool-outcome-manual-check/)
})

test('does not resume complete, blocked, or budget-exhausted goals', async () => {
  for (const goal of [
    { phase: 'complete' },
    { phase: 'blocked' },
    { maxGoalRounds: 1, roundsStarted: 1 },
  ]) {
    const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-terminal-'))
    roots.push(root)
    const f = makeContext(root, interruptedEvents({ balanced: true, goal }), { cacheAsOfSeq: 3 })
    const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
    const result = await coordinator.reconcile()
    await coordinator.dispose()
    assert.equal(result.resumed, 0)
    assert.equal(f.resumeCount, 0)
    assert.equal(f.goalResumeCount, 0)
  }
})

test('rechecks the physical revision before resuming', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-race-'))
  roots.push(root)
  const f = makeContext(root, interruptedEvents(), { cacheAsOfSeq: 4, revision: 'revision-1' })
  let calls = 0
  const original = f.ctx.sessionPersistence.listSnapshots
  f.ctx.sessionPersistence.listSnapshots = async () => [{ header: { id: f.id }, revision: calls++ === 0 ? 'revision-1' : 'revision-2' }]
  const coordinator = new SessionRecoveryCoordinator(f.ctx, { leasePath: join(root, 'recovery.lock') })
  const result = await coordinator.reconcile()
  await coordinator.dispose()
  assert.equal(result.resumed, 0)
  assert.equal(f.resumeCount, 0)
  assert.equal(calls, 2)
  f.ctx.sessionPersistence.listSnapshots = original
})

test('a competing lease blocks recovery and stale locks are reclaimed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-lease-'))
  roots.push(root)
  const location = join(root, 'nested', 'recovery.lock')
  const first = await acquireRecoveryLease(location, { now: 1000, owner: 'first' })
  assert.notEqual(first, undefined)
  const second = await acquireRecoveryLease(location, { now: 1001, staleAfterMs: 100 })
  assert.equal(second, undefined)
  await first.release()
  const stale = await acquireRecoveryLease(location, { now: 1000 })
  assert.notEqual(stale, undefined)
  await stale.release()
  await writeFile(location, JSON.stringify({ token: 'old', createdAt: 1 }))
  await utimes(location, new Date(1), new Date(1))
  const reclaimed = await acquireRecoveryLease(location, { now: 1000, staleAfterMs: 100 })
  assert.notEqual(reclaimed, undefined)
  await reclaimed.release()
  await assert.rejects(stat(location), { code: 'ENOENT' })
})

test('a live lease heartbeat prevents takeover past the stale threshold', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-heartbeat-'))
  roots.push(root)
  const location = join(root, 'recovery.lock')
  const first = await acquireRecoveryLease(location, {
    staleAfterMs: 35,
    heartbeatMs: 5,
  })
  assert.notEqual(first, undefined)
  await new Promise(resolve => setTimeout(resolve, 90))
  const second = await acquireRecoveryLease(location, { staleAfterMs: 35 })
  assert.equal(second, undefined)
  await first.release()
  const afterRelease = await acquireRecoveryLease(location, { staleAfterMs: 35 })
  assert.notEqual(afterRelease, undefined)
  await afterRelease.release()
})

test('supports an injected clock for deterministic lease-age checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-recovery-fake-clock-'))
  roots.push(root)
  const location = join(root, 'recovery.lock')
  let now = 10_000
  const first = await acquireRecoveryLease(location, {
    now: () => now,
    clock: () => now,
    staleAfterMs: 100,
    heartbeatMs: 5,
  })
  assert.notEqual(first, undefined)
  await new Promise(resolve => setTimeout(resolve, 20))
  now += 1_000
  await new Promise(resolve => setTimeout(resolve, 20))
  const second = await acquireRecoveryLease(location, {
    now: () => now,
    staleAfterMs: 100,
  })
  assert.equal(second, undefined)
  await first.release()
})
