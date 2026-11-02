import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Worker } from 'node:worker_threads'
import { acquireKernelLease } from '../lib/lease.js'

test('kernel leases share canonical directory identity and release idempotently', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-kernel-identity-'))
  let first, successor
  try {
    const real = join(root, 'real')
    const alias = join(root, 'alias')
    await mkdir(real)
    await symlink(real, alias, process.platform === 'win32' ? 'junction' : 'dir')
    first = await acquireKernelLease(join(real, 'recovery.guard'))
    assert.notEqual(first, undefined)
    assert.equal(await acquireKernelLease(join(alias, 'recovery.guard')), undefined)
    await Promise.all([first.release(), first.release()])
    successor = await acquireKernelLease(join(alias, 'recovery.guard'))
    assert.notEqual(successor, undefined)
    assert.equal(await acquireKernelLease(join(real, 'recovery.guard')), undefined)
  } finally {
    await first?.release()
    await successor?.release()
    await rm(root, { recursive: true, force: true })
  }
})

test('kernel ownership excludes another thread and becomes available after release', { timeout: 10000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-kernel-thread-'))
  const location = join(root, 'recovery.guard')
  let first, worker
  try {
    first = await acquireKernelLease(location)
    assert.notEqual(first, undefined)
    worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      import(workerData.moduleUrl).then(({ acquireKernelLease }) => {
        parentPort.on('message', async () => {
          const lease = await acquireKernelLease(workerData.location);
          await lease?.release();
          parentPort.postMessage(lease === undefined ? 'busy' : 'acquired');
        });
        parentPort.postMessage('ready');
      });
    `, { eval: true, workerData: { location, moduleUrl: new URL('../lib/lease.js', import.meta.url).href } })
    assert.deepEqual(await once(worker, 'message'), ['ready'])
    const busy = once(worker, 'message')
    worker.postMessage('acquire')
    assert.deepEqual(await busy, ['busy'])
    await first.release()
    const acquired = once(worker, 'message')
    worker.postMessage('acquire')
    assert.deepEqual(await acquired, ['acquired'])
  } finally {
    await worker?.terminate()
    await first?.release()
    await rm(root, { recursive: true, force: true })
  }
})
