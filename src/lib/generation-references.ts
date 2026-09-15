import { open } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import type { MeiGenConfig } from '../config.js'
import { GenerationError } from './generation-contract.js'
import { unsafeReferenceUrlReason } from './url-safety.js'
import { processAndUploadReferenceBuffer } from './upload.js'
import { abortReason } from './generation-http.js'

type Reference = { identity: string; url: string } | { identity: string; bytes: Buffer; name: string }
export function publicReferenceUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port || unsafeReferenceUrlReason(value)) throw new Error('unsafe')
    return url.toString()
  } catch { throw new GenerationError('Use a direct public HTTPS URL without credentials, fragments or custom ports.', 'invalid_reference') }
}
export function localReferencePath(value: string): string | undefined {
  if (/^\\\\[?.]\\/.test(value)) throw new GenerationError('Device paths are unsupported.', 'invalid_reference')
  if (/^[a-z]:[/\\]/i.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value) || value.startsWith('/')) return value
  if (value.startsWith('~/')) return `${homedir()}/${value.slice(2)}`
  if (/^file:\/\//i.test(value)) {
    const url = new URL(value)
    if (url.username || url.password || url.hash || url.search) throw new GenerationError('Use a file URL without credentials, query or fragment.', 'invalid_reference')
    return fileURLToPath(url)
  }
  if (/^https:\/\//i.test(value)) return undefined
  throw new GenerationError('Use an accessible absolute image path, ~/ or file://, or a public HTTPS URL. Relative paths are ambiguous; never invent attachment paths.', 'invalid_reference')
}
export async function fingerprintReferences(values: string[], signal?: AbortSignal): Promise<Reference[]> {
  return await Promise.all(values.map(async value => {
    abortReason(signal)
    const path = localReferencePath(value)
    if (!path) { const url = publicReferenceUrl(value); return { identity: url, url } }
    const handle = await open(path, 'r')
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new GenerationError('Local references must be regular JPEG, PNG, WebP or GIF images up to 32 MiB.', 'invalid_reference')
      // Read from this handle once: the exact fingerprinted bytes are also what gets uploaded.
      const bytes = Buffer.alloc(stat.size + 1)
      let size = 0
      while (size < bytes.length) { const read = await handle.read(bytes, size, bytes.length - size, null); if (!read.bytesRead) break; size += read.bytesRead }
      if (size !== stat.size) throw new GenerationError('Reference image changed while being read; retry after saving the file.', 'reference_changed')
      const input = bytes.subarray(0, size)
      return { identity: createHash('sha256').update(input).digest('hex'), bytes: input, name: basename(path) }
    } finally { await handle.close() }
  }))
}
export async function uploadReferences(references: Reference[], config: MeiGenConfig, signal?: AbortSignal): Promise<string[]> {
  const urls: string[] = []
  for (const reference of references) {
    abortReason(signal)
    urls.push('url' in reference ? reference.url : publicReferenceUrl(await processAndUploadReferenceBuffer(reference.bytes, reference.name, config, signal)))
  }
  return urls
}
