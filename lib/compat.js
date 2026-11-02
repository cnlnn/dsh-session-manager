// Version-sensitive storage calls and write ownership adapters.
export function settingValue(value, fallback) {
  return (typeof value?.get === 'function' ? value.get() : value) ?? fallback
}

export async function storedHeaders(persistence) {
  return (await persistence.list()).map(row => row.header ?? row)
}

export async function readStored(persistence, id, offset = 0) {
  if (typeof persistence.readFrom === 'function') return persistence.readFrom(id, offset)
  const handle = await persistence.open(id, 'read')
  try {
    const slice = await handle.read(offset)
    return { ...slice, meta: handle.header, inheritedEventCount: handle.inheritedEventCount }
  } finally {
    await handle.close()
  }
}

export async function reserveStored(persistence, id) {
  if (typeof persistence.prepare === 'function') {
    const preparation = await persistence.prepare(id)
    return { header: preparation.session.header, release: () => preparation[Symbol.dispose](), retain: true }
  }
  const handle = await persistence.open(id, 'write')
  return { header: handle.header, release: () => handle.close(), retain: false }
}

export function supportsDirectoryLock(persistence) {
  return typeof persistence.acquireLease === 'function' || typeof persistence.open === 'function'
}

export function requireDirectoryLock(persistence) {
  if (supportsDirectoryLock(persistence)) return
  throw Object.assign(new Error('The active storage backend does not provide an exclusive directory lock'), {
    code: 'SESSION_DIRECTORY_LOCK_UNAVAILABLE',
  })
}

export async function lockStoredDirectory(persistence, meta, directory) {
  requireDirectoryLock(persistence)
  // JSONL exposes its directory lease separately from decoding and migration.
  if (typeof persistence.acquireLease === 'function') {
    return persistence.acquireLease(meta.id, undefined, directory)
  }
  const handle = await persistence.open(meta.id, 'write')
  return { release: () => handle.close() }
}

export async function rebuildProjection(ctx, id) {
  const cache = ctx.get?.('sessionProjectionCache') ?? ctx.sessionProjectionCache
  if (typeof cache?.coldSnapshot !== 'function') return
  const persistence = ctx.sessionPersistence ?? ctx.get?.('sessionPersistence')
  if (typeof persistence.open !== 'function') return cache.coldSnapshot(id)
  const raw = await readStored(persistence, id)
  return cache.coldSnapshot(raw.meta, raw.inheritedEventCount, raw.events)
}

export function resolveStoredPreset(meta, events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'agent-preset/selected') return events[index].data.agentPreset
  }
  return meta.agentPreset
}
