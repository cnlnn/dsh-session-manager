import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import * as Settings from '@deepseek-ai/dsh-settings'
import { apply, Config, SessionTrashManager } from '../index.js'
import { readStored, reserveStored, settingValue, storedHeaders, resolveStoredPreset } from '../lib/compat.js'

test('live config reads current volatile values without losing false', () => {
  let value = true
  const ref = { get: () => value }
  assert.equal(settingValue(ref, false), true)
  value = false
  assert.equal(settingValue(ref, true), false)
  assert.equal(settingValue(false, true), false)
  assert.equal(settingValue(undefined, true), true)
})

test('settings registration follows the installed DSH settings generation', () => {
  let registered = false
  let configured = false
  const ctx = {
    fiber: {}, on() {},
    effect(callback, label) { if (label === undefined) callback() },
    inject(_services, callback) { callback(this) },
  }
  ctx.settings = {
    ctx,
    register(ns, schema, options) {
      assert.equal(ns, 'session-manager')
      registered = true
      return { get: () => schema(options.base), watch() {} }
    },
    configure() { configured = true; return () => {} },
  }
  const prototype = Settings.default.prototype
  if (typeof prototype.installSection === 'function') ctx.settings.installSection = prototype.installSection
  apply(ctx, { trashDirectory: '/tmp/dsm-test', showSidebarTrash: true, autoRecoverInterruptedGoals: false })
  if (typeof Settings.installSettingsSection === 'function' || typeof prototype.installSection === 'function') {
    assert.equal(registered, true)
  } else {
    assert.equal(configured, true)
    const serialized = JSON.stringify(Config.toJSON())
    assert.match(serialized, /"volatile":true/)
  }
})

test('handle storage closes read handles on success and failure, and preserves write ownership', async () => {
  const meta = { id: 'test' }
  const calls = []
  let fail = false
  const persistence = {
    list: async () => [{ header: meta, revision: 'one' }],
    async open(id, access) {
      calls.push([id, access])
      return {
        header: meta, inheritedEventCount: 0,
        async read() { if (fail) throw new Error('read failed'); return { events: [] } },
        async close() { calls.push('close') },
      }
    },
  }
  assert.deepEqual(await storedHeaders(persistence), [meta])
  assert.deepEqual((await readStored(persistence, 'test')).meta, meta)
  fail = true
  await assert.rejects(readStored(persistence, 'test'), /read failed/)
  const reservation = await reserveStored(persistence, 'test')
  assert.equal(reservation.header, meta)
  await reservation.release()
  assert.deepEqual(calls, [['test', 'read'], 'close', ['test', 'read'], 'close', ['test', 'write'], 'close'])
})

test('preset reconstruction uses the latest selection, not the creation header', () => {
  assert.equal(resolveStoredPreset({ agentPreset: 'first' }, [
    { type: 'agent-preset/selected', data: { agentPreset: 'second' } },
  ]), 'second')
})

test('client settings supports legacy envelopes and modern positional Remote calls', async () => {
  let client
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(definition) { client = definition.factory(() => ({})) } } },
    document: { querySelector: () => ({}) },
  })
  const legacy = { settings: {} }
  assert.equal(client.settingsApi({ get: () => ({ api: legacy }) }), legacy)
  const calls = []
  const result = { ok: true, value: { namespaces: [] } }
  const remote = { settings: {
    async describe(...args) { calls.push(args); return result },
    async mutate(...args) { calls.push(args); return result },
  } }
  const ctx = { get: name => name === 'remote' ? remote : {} }
  const api = client.settingsApi(ctx)
  assert.equal(client.settingsApi(ctx), api)
  assert.deepEqual((await api.settings.describe({})).result, result)
  await api.settings.mutate({ ns: 'session-manager', ops: [], expectedRevision: 2 })
  assert.deepEqual(calls, [[], ['session-manager', [], 2]])
})

test('modern client slots render with renamed icons and native session menu hooks', async () => {
  let client
  const entries = []
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      assert.notEqual(type, undefined, 'missing client component export')
      return typeof type === 'function' ? type({ ...props, children }) : { type, props, children }
    },
    useState: value => [typeof value === 'function' ? value() : value, () => {}],
    useEffect() {},
    useCallback: value => value,
  }
  const icon = () => null
  const primitives = { IconChevronDownOutlineRegular: icon, IconCloseOutlineRegular: icon, IconTrashOutlineRegular: icon, MenuItemButton: icon }
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(definition) { client = definition.factory(name => name === 'react' ? React : primitives) } } },
    document: { querySelector: () => ({}) },
  })
  const ctx = {
    get: () => ({}), effect() {},
    inject(names, callback) { assert.deepEqual([...names], ['remote', 'remote.settings']); callback(this) },
    slots: {
      inject(name, callback) { if (name !== 'settings.plugin.item') callback() },
      register(options, component) { entries.push({ options, component }); return () => {} },
    },
  }
  client.apply(ctx)
  for (const { component } of entries) component({ wide: true, sessionId: 'test', useMenuOpenState: () => [false, () => {}] })
  assert.equal(entries.filter(row => row.options.name === 'sidebar.workspaces.session.menu.item').length, 2)
  assert.equal(entries.filter(row => row.options.name === 'settings.plugins.tab').length, 1)
})

let Jsonl
try {
  Jsonl = (await import('@deepseek-ai/dsh-session-persistence-jsonl')).default
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes("'@deepseek-ai/dsh-session-persistence-jsonl'")) throw error
}

for (const compression of ['none', 'zstd']) test(`real JSONL (${compression}): inventory, writer protection, trash, restore, and delete`, { skip: Jsonl === undefined }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsm-native-'))
  const ctx = new Context()
  let manager
  try {
    await ctx.plugin(SessionStore)
    await ctx.plugin(Jsonl, { root: join(root, 'sessions'), compression })
    const id = 'session-11111111-1111-4111-8111-111111111111'
    const session = ctx.sessions.prepare(id, { meta: { cwd: root } })
    const p = ctx.sessionPersistence
    const event = { seq: 0, time: Date.now(), type: 'session/title', data: { title: 'Compatibility check', source: { kind: 'user' }, messageSeqs: [] } }
    const handle = await p.create(session.header)
    if (handle !== undefined) {
      await handle.append([event])
      await handle.flush()
      await handle.close()
    } else await p.append(id, [event])
    manager = new SessionTrashManager(ctx, { trashDirectory: join(root, 'trash') })
    assert.equal((await manager.list()).sessions[0].id, id)
    assert.deepEqual((await readStored(p, id)).events, [event])
    if (typeof p.open === 'function') {
      const writer = await p.open(id, 'write')
      try { await assert.rejects(manager.trash(id)) } finally { await writer.close() }
      assert.equal((await manager.list()).sessions.length, 1)
    }
    const trashed = await manager.trash(id)
    assert.equal((await manager.list()).sessions.length, 0)
    assert.equal((await manager.list()).trash.length, 1)
    await manager.restore(trashed.trashId)
    assert.equal((await manager.list()).sessions[0].id, id)
    assert.deepEqual((await readStored(p, id)).events, [event])
    await manager.deleteForever(id)
    assert.equal((await manager.list()).sessions.length, 0)
  } finally {
    manager?.dispose()
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
