import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, realpath, stat } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { tryLockExclusive } from '@deepseek-ai/node-addon-system/flock'

const windowsHeld = new Set()
let windowsApi

async function acquireWindowsLease(location) {
  const key = location.toLowerCase()
  if (windowsHeld.has(key)) return undefined
  windowsHeld.add(key)
  let handle
  let acquired = false
  try {
    if (windowsApi === undefined) {
      const kernel = (await import('koffi')).default.load('kernel32.dll')
      windowsApi = {
        create: kernel.func('__stdcall', 'CreateMutexW', 'intptr', ['void*', 'int', 'str16']),
        wait: kernel.func('__stdcall', 'WaitForSingleObject', 'uint', ['intptr', 'uint']),
        release: kernel.func('__stdcall', 'ReleaseMutex', 'int', ['intptr']),
        close: kernel.func('__stdcall', 'CloseHandle', 'int', ['intptr']),
      }
    }
    const name = `Local\\dsh-session-manager-${createHash('sha256').update(key).digest('hex')}`
    handle = windowsApi.create(null, 0, name)
    if (!handle) throw new Error('Could not create the recovery mutex')
    const outcome = windowsApi.wait(handle, 0)
    // WAIT_ABANDONED grants ownership after the previous process exited.
    if (outcome !== 0 && outcome !== 128) {
      if (outcome === 258) return undefined
      throw new Error('Could not acquire the recovery mutex')
    }
    const owned = handle
    handle = undefined
    acquired = true
    let released = false
    return {
      async release() {
        if (released) return
        released = true
        try {
          const unlocked = windowsApi.release(owned)
          const closed = windowsApi.close(owned)
          if (!unlocked || !closed) throw new Error('Could not release the recovery mutex')
        } finally {
          windowsHeld.delete(key)
        }
      },
    }
  } finally {
    if (handle !== undefined) windowsApi.close(handle)
    if (!acquired) windowsHeld.delete(key)
  }
}

/** Kernel ownership lasts until release or process exit; the POSIX inode stays stable. */
export async function acquireKernelLease(location) {
  await mkdir(dirname(location), { recursive: true, mode: 0o700 })
  const canonical = join(await realpath(dirname(location)), basename(location))
  if (process.platform === 'win32') return acquireWindowsLease(canonical)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const handle = await open(canonical, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, 0o600)
    let retained = false
    try {
      try {
        await tryLockExclusive(handle.fd)
      } catch (error) {
        if (error?.code === 'EAGAIN' || error?.code === 'EWOULDBLOCK') return undefined
        throw error
      }
      const held = await handle.stat({ bigint: true })
      const current = await stat(canonical, { bigint: true }).catch(error => {
        if (error?.code === 'ENOENT') return undefined
        throw error
      })
      if (held.ino !== current?.ino || held.dev !== current?.dev) continue
      retained = true
      let releasePromise
      return { release: () => releasePromise ??= handle.close() }
    } finally {
      if (!retained) await handle.close()
    }
  }
  throw new Error('Recovery lock path changed during acquisition')
}
