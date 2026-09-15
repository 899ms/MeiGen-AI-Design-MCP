import { createHash, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { MeiGenConfig } from '../config.js'
import type { MeiGenApiClient, MeiGenGenerationStatus } from './meigen-api.js'
import { GenerationError, type GenerationOutput, errorOutput, isRequestNotFound } from './generation-contract.js'
import { withGenerationReceipt } from './generation-request-store.js'
import { fingerprintReferences, uploadReferences, publicReferenceUrl } from './generation-references.js'
import { streamResponseToFile, withHttpResponse, abortReason } from './generation-http.js'

export interface GenerationInput {
  prompt: string
  modelId?: string
  aspectRatio?: string
  resolution?: string
  modelVariant?: string
  quality?: string
  tier?: string
  duration?: number
  referenceImages?: string[]
  referenceVideo?: string
  requestId?: string
  wait?: boolean
  download?: boolean
}

export function generationStatusOutput(status: MeiGenGenerationStatus, context: Partial<GenerationOutput>): GenerationOutput {
  const mediaType = status.mediaType ?? context.mediaType ?? 'image'
  const urls = mediaType === 'video' ? (status.videoUrl ? [status.videoUrl] : []) : (status.imageUrls?.length ? status.imageUrls : status.imageUrl ? [status.imageUrl] : [])
  const body: GenerationOutput = { success: status.status !== 'failed', status: status.status, provider: 'meigen', urls, ...context, mediaType,
    ...(status.generationId ? { generationId: status.generationId } : {}), ...(status.modelId ? { modelId: status.modelId } : {}),
    ...(typeof status.creditsUsed === 'number' ? { creditsUsed: status.creditsUsed } : {}), ...(status.creditsStatus ? { creditsStatus: status.creditsStatus } : {}),
    ...(mediaType === 'video' && urls[0] ? { videoUrl: urls[0] } : urls[0] ? { imageUrl: urls[0] } : {}) }
  delete body.pollAfterSeconds
  delete body.observationEnded
  const checkArguments = { ...(body.generationId ? { generationId: body.generationId } : { requestId: body.requestId }), ...(body.requestedMediaType ? { requestedMediaType: body.requestedMediaType } : {}) }
  if (status.status === 'failed') return { ...body, error: { code: status.failureCode || 'generation_failed', message: status.error ?? 'Generation failed', retryable: false }, nextAction: { type: 'review_failure', message: 'Review this job and its reported creditsStatus. An intentionally new generation requires a new requestId.' } }
  if (status.status === 'completed' && !urls.length) return { ...body, status: 'unknown', success: false, error: { code: 'result_pending', message: 'Generation completed but the result URL is missing. Do NOT re-submit with a new UUID.', retryable: true }, nextAction: { type: 'check_generation', tool: 'check_generation', arguments: checkArguments, afterSeconds: 30 } }
  if (status.status === 'processing') {
    const ended = typeof status.pollHintSeconds === 'number' && status.pollHintSeconds <= 0
    return { ...body, ...(ended ? {} : { pollAfterSeconds: 30 }), observationEnded: ended, nextAction: ended ? { type: 'check_gallery', message: 'The observation window ended; this is not proof of failure or refund. Keep the existing request and check later.' } : { type: 'check_generation', tool: 'check_generation', arguments: checkArguments, afterSeconds: 30 } }
  }
  const requestedMediaType = context.requestedMediaType ?? context.mediaType
  if (requestedMediaType && requestedMediaType !== mediaType) {
    return { ...body, requestedMediaType, nextAction: { type: 'review_media_type', message: `This request produced ${mediaType} instead of the requested ${requestedMediaType}. Keep its result URLs and IDs, and review the selected model before advancing the workflow. Do not automatically submit another paid generation.` } }
  }
  return { ...body, nextAction: { type: 'use_result', message: 'Pass these URLs to the next workflow step or present them when appropriate.' } }
}

async function saveGenerationResult(body: GenerationOutput, signal?: AbortSignal): Promise<string> {
  const video = body.mediaType === 'video'
  const url = publicReferenceUrl(body.urls[0])
  const custom = video ? process.env.MEIGEN_VIDEO_OUTPUT_DIR : process.env.MEIGEN_OUTPUT_DIR
  const xdg = video ? process.env.XDG_VIDEOS_DIR : process.env.XDG_PICTURES_DIR
  const expand = (path: string) => path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
  const directory = custom ? expand(custom) : xdg ? join(expand(xdg), 'meigen') : join(homedir(), video ? 'Movies' : 'Pictures', 'meigen')
  await mkdir(directory, { recursive: true })
  return await withHttpResponse(url, { redirect: 'error' }, video ? 120_000 : 30_000, async (response, downloadSignal) => {
    if (!response.ok) throw new GenerationError(`Result download failed (${response.status}).`, 'download_failed', response.status, true)
    const type = response.headers.get('content-type') ?? ''
    const extension = video ? 'mp4' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const path = join(directory, `${new Date().toISOString().slice(0, 10)}_${randomUUID()}.${extension}`)
    await streamResponseToFile(response, path, video ? 512 * 1024 * 1024 : 64 * 1024 * 1024, downloadSignal)
    return path
  }, signal)
}

export async function runMeiGenGeneration(mediaType: 'image' | 'video', input: GenerationInput, api: MeiGenApiClient, config: MeiGenConfig, signal?: AbortSignal, notify?: (message: string) => Promise<void>): Promise<GenerationOutput> {
  const requestId = (input.requestId ?? randomUUID()).toLowerCase()
  const context: Partial<GenerationOutput> = { provider: 'meigen', requestId, mediaType, requestedMediaType: mediaType }
  try {
    if (input.wait === false && !input.requestId) throw new GenerationError('wait=false requires a persistent requestId UUID chosen by the caller.', 'request_id_required')
    if (!config.meigenApiToken) throw new GenerationError('MEIGEN_API_TOKEN is required. Create a key at https://www.meigen.ai/profile/api-keys and configure it privately. API generation uses purchased credits only.', 'authentication_required', 401)
    abortReason(signal)
    const references = await fingerprintReferences(input.referenceImages ?? [], signal)
    const { requestId: _id, wait: _wait, download: _download, referenceImages: _references, ...parameters } = input
    if (parameters.referenceVideo) parameters.referenceVideo = publicReferenceUrl(parameters.referenceVideo)
    const canonicalParameters = Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)))
    const fingerprint = createHash('sha256').update(JSON.stringify({ mediaType, parameters: canonicalParameters, references: references.map(value => value.identity) })).digest('hex')
    const submitted = await withGenerationReceipt(config, requestId, fingerprint, async (receipt, save) => {
      if (input.requestId || receipt.references || receipt.generationId) {
        try {
          // Authorize the current account after key rotation; a local receipt is not access control.
          const existing = await api.getGenerationByRequestId(requestId, signal)
          if (!existing.generationId) throw new GenerationError('Existing request has no generationId yet; query it again shortly.', 'in_progress', 409, true, { retryAfterSeconds: 5 })
          receipt.generationId = existing.generationId; receipt.modelId = existing.modelId; receipt.creditsUsed = existing.creditsUsed
          context.generationId = existing.generationId
          await save()
          return { ...existing, success: true, error: existing.error ?? undefined, deduped: true }
        } catch (error) {
          // A lost POST may have no server receipt. Reuse its prepared URLs and the exact UUID.
          // Never expose a cached job under another account or automatically create a replacement.
          if (isRequestNotFound(error) && receipt.generationId) throw new GenerationError('This saved request is not accessible with the current account. Use the original account to recover it; only an intentionally new generation should use a new UUID.', 'request_id_collision', 409)
          const unsubmitted = isRequestNotFound(error) && !receipt.generationId
          const paymentRetry = error instanceof GenerationError && error.httpStatus === 402 && !receipt.generationId
          const expiredLease = error instanceof GenerationError && error.code === 'in_progress' && error.details.retryAfterSeconds === 0 && !receipt.generationId
          if (!unsubmitted && !paymentRetry && !expiredLease) throw error
        }
      }
      if (!receipt.references) { receipt.references = await uploadReferences(references, config, signal); await save() }
      const params = { ...parameters, requestId, referenceImages: receipt.references, signal }
      const result = mediaType === 'video' ? await api.generateVideo({ ...params, modelId: input.modelId! }) : await api.generateImage(params)
      // Persist the accepted handle BEFORE polling or optional downloads. Never clear it on terminal results.
      receipt.generationId = result.generationId; receipt.modelId = result.modelId; receipt.creditsUsed = result.creditsUsed
      context.generationId = result.generationId
      await save()
      return result
    }, signal, warning => { context.receiptWarning = warning })
    Object.assign(context, { generationId: submitted.generationId, modelId: submitted.modelId, creditsUsed: submitted.creditsUsed, deduped: submitted.deduped })
    const knownStatus = generationStatusOutput({ ...submitted, status: submitted.status ?? 'processing', imageUrl: submitted.imageUrl ?? null, imageUrls: submitted.imageUrls ?? null, error: submitted.error ?? null }, context)
    if (input.wait === false) return knownStatus
    await notify?.(`Generation accepted. requestId=${requestId}; generationId=${submitted.generationId}. Waiting for completion...`)
    const result = knownStatus.status !== 'processing' ? knownStatus : generationStatusOutput(await api.waitForGeneration(submitted.generationId!, undefined, async elapsed => { await notify?.(`Generation ${submitted.generationId} is still processing (${Math.round(elapsed / 1000)}s).`) }, signal), context)
    if (result.status === 'completed' && result.success && input.download !== false) {
      try { result.savedPath = await saveGenerationResult(result, signal) }
      catch (error) { result.downloadWarning = `Local save skipped: ${error instanceof Error ? error.message : 'download failed'}. The generation succeeded; keep its URLs and IDs.` }
    }
    return result
  } catch (error) { return errorOutput(error, context) }
}
