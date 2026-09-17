import { constants } from 'node:fs'
import { mkdir, open, lstat, link, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { MeiGenConfig } from '../config.js'
import { GenerationError } from './generation-contract.js'
import { Semaphore } from './semaphore.js'
import { abortReason } from './generation-http.js'

export interface GenerationReceipt {
  version: 1
  requestId: string
  fingerprint: string
  references?: string[]
  /** Reference VIDEO URLs, published write-once alongside (never inside) references.json. */
  videoReferences?: string[]
  /** Reference AUDIO URLs, published write-once alongside (never inside) references.json. */
  audioReferences?: string[]
  generationId?: string
  modelId?: string
  creditsUsed?: number
}
/** Additive write-once receipt files. references.json keeps its exact historical shape. */
const MEDIA_RECEIPTS = [
  { field: 'videoReferences', file: 'video-references.json' },
  { field: 'audioReferences', file: 'audio-references.json' },
] as const satisfies ReadonlyArray<{ field: 'videoReferences' | 'audioReferences'; file: string }>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const localLocks = new Map<string, { semaphore: Semaphore; users: number }>()
const memoryReceipts = new Map<string, GenerationReceipt>()
const RECEIPT_WARNING = 'Local durable receipts are unavailable; this process is using a bounded memory cache. Keep the returned requestId and recover through check_generation before retrying after a restart. Set MEIGEN_REQUEST_STORE_DIR to an owned private directory (0700), not a symlink; do not relax permissions.'
function canUseMemory(error: unknown): boolean {
  return error instanceof GenerationError ? error.code === 'unsafe_receipt_store'
    : ['EEXIST', 'EACCES', 'EPERM', 'EROFS', 'ENOSPC', 'EDQUOT', 'EIO', 'ENOTDIR', 'ENOENT', 'EMFILE', 'ENFILE', 'ELOOP', 'EXDEV', 'ENOTSUP'].includes((error as NodeJS.ErrnoException)?.code ?? '')
}
function remember(key: string, receipt: GenerationReceipt) {
  memoryReceipts.delete(key)
  memoryReceipts.set(key, { ...receipt,
    ...(receipt.references ? { references: [...receipt.references] } : {}),
    ...(receipt.videoReferences ? { videoReferences: [...receipt.videoReferences] } : {}),
    ...(receipt.audioReferences ? { audioReferences: [...receipt.audioReferences] } : {}) })
  if (memoryReceipts.size > 256) memoryReceipts.delete(memoryReceipts.keys().next().value!)
}
function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === 'ENOENT' }

async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))) {
    throw new GenerationError('The generation receipt directory must be private to this OS user (0700) and must not be a symlink.', 'unsafe_receipt_store')
  }
}
async function readPrivate<T>(path: string): Promise<T> {
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 256 * 1024 || (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))) throw new GenerationError('Generation receipt is not a private regular file.', 'unsafe_receipt_store')
    const content = await handle.readFile('utf8')
    try { return JSON.parse(content) as T }
    catch { throw new GenerationError('Generation receipt is invalid; preserve it and query requestId before recovering.', 'invalid_receipt') }
  } finally { await handle.close() }
}

/** Publish complete immutable data atomically. Concurrent processes read the same winner.
 * Unlike stale process locks, a crash cannot leave a lock requiring unsafe takeover.
 * Temporary files are never interpreted as receipts. No overwrite, TTL, raw key or prompt.
 */
async function publishOnce<T>(path: string, data: T): Promise<T> {
  const temporary = `${path}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    try { await handle.writeFile(JSON.stringify(data)); await handle.sync() } finally { await handle.close() }
    try { await link(temporary, path) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    return await readPrivate<T>(path)
  } finally { try { await unlink(temporary) } catch (error) { if (!missing(error)) throw error } }

}

/** Site-scoped to survive API-key rotation. A cached generationId is NEVER authorization:
 * the caller must revalidate it with the authenticated backend before returning it.
 * Process-local serialization avoids redundant work; cross-process publication only
 * selects immutable inputs. The backend UUID contract prevents duplicate paid jobs.
 */
export async function withGenerationReceipt<T>(config: MeiGenConfig, requestId: string, fingerprint: string, run: (receipt: GenerationReceipt, save: () => Promise<void>) => Promise<T>, signal?: AbortSignal, onWarning?: (warning: string) => void): Promise<T> {
  if (!UUID.test(requestId)) throw new GenerationError('requestId must be a UUID.', 'invalid_request_id')
  abortReason(signal)
  const scope = createHash('sha256').update(config.meigenBaseUrl.replace(/\/$/, '')).digest('hex')
  const root = process.env.MEIGEN_REQUEST_STORE_DIR || join(homedir(), '.meigen', 'requests')
  const scopeDirectory = join(root, scope)
  const directory = join(scopeDirectory, requestId.toLowerCase())
  const lock = localLocks.get(directory) ?? { semaphore: new Semaphore(1), users: 0 }
  lock.users++; localLocks.set(directory, lock)
  let acquired = false
  try {
    await lock.semaphore.acquire(signal); acquired = true; abortReason(signal)
    const identity = { version: 1 as const, requestId: requestId.toLowerCase(), fingerprint }
    let receipt: GenerationReceipt = { ...memoryReceipts.get(directory) ?? identity }
    const checkIdentity = (saved: GenerationReceipt) => {
      if (saved?.version !== 1 || saved.requestId !== identity.requestId || typeof saved.fingerprint !== 'string') throw new GenerationError('Generation receipt is invalid; preserve it and query requestId before recovering.', 'invalid_receipt')
      if (saved.fingerprint !== fingerprint) throw new GenerationError('This requestId was already used with different inputs. Restore the original inputs, or use a new UUID for an intentionally new generation.', 'idempotency_conflict', 409)
    }
    checkIdentity(receipt)
    let durable = true
    const fallback = (error: unknown) => {
      if (!canUseMemory(error)) throw error
      durable = false
      onWarning?.(RECEIPT_WARNING)
    }
    try {
      await privateDirectory(root)
      await privateDirectory(scopeDirectory)
      await privateDirectory(directory)
      const saved = await publishOnce(join(directory, 'identity.json'), identity)
      checkIdentity(saved)
      receipt = { ...receipt, ...saved }
      try {
        const references = await readPrivate<{ references: string[] }>(join(directory, 'references.json'))
        if (!Array.isArray(references.references) || references.references.some(value => typeof value !== 'string')) throw new GenerationError('Stored reference URLs are invalid.', 'invalid_receipt')
        receipt.references = references.references
      } catch (error) { if (!missing(error)) throw error }
      for (const media of MEDIA_RECEIPTS) {
        try {
          const stored = await readPrivate<{ references: string[] }>(join(directory, media.file))
          if (!Array.isArray(stored.references) || stored.references.some(value => typeof value !== 'string')) throw new GenerationError('Stored reference URLs are invalid.', 'invalid_receipt')
          receipt[media.field] = stored.references
        } catch (error) { if (!missing(error)) throw error }
      }
      try {
        const job = await readPrivate<{ generationId: string; modelId?: string; creditsUsed?: number }>(join(directory, 'job.json'))
        if (typeof job.generationId !== 'string' || !job.generationId) throw new GenerationError('Stored job identity is invalid.', 'invalid_receipt')
        Object.assign(receipt, job)
      } catch (error) { if (!missing(error)) throw error }
    } catch (error) { fallback(error) }
    remember(directory, receipt)
    const save = async () => {
      if (durable) try {
        if (receipt.references) {
          const winner = await publishOnce(join(directory, 'references.json'), { references: receipt.references })
          // Cross-process immutable publication selects the URLs; the backend arbitrates paid identity.
          if (!Array.isArray(winner.references) || winner.references.some(value => typeof value !== 'string')) throw new GenerationError('Stored reference URLs are invalid.', 'invalid_receipt')
          receipt.references = winner.references
        }
        for (const media of MEDIA_RECEIPTS) {
          const pending = receipt[media.field]
          if (!pending) continue
          const winner = await publishOnce(join(directory, media.file), { references: pending })
          if (!Array.isArray(winner.references) || winner.references.some(value => typeof value !== 'string')) throw new GenerationError('Stored reference URLs are invalid.', 'invalid_receipt')
          receipt[media.field] = winner.references
        }
        if (receipt.generationId) {
          const winner = await publishOnce(join(directory, 'job.json'), { generationId: receipt.generationId, modelId: receipt.modelId, creditsUsed: receipt.creditsUsed })
          if (winner.generationId !== receipt.generationId) throw new GenerationError('Backend returned conflicting jobs for one requestId. Query requestId before any further action.', 'request_id_collision', 409)
        }
      } catch (error) { fallback(error) }
      remember(directory, receipt)
    }
    // Never catch/re-run the callback: it may already have submitted a paid request.
    return await run(receipt, save)
  } finally {
    if (acquired) lock.semaphore.release()
    lock.users--
    if (lock.users === 0) localLocks.delete(directory)
  }
}
