import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, readdir, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import apiModule from '../lib/meigen-api.js'
import operationModule from '../lib/generation-operation.js'
import contractModule from '../lib/generation-contract.js'
import httpModule from '../lib/generation-http.js'
import comfyModule from '../lib/providers/comfyui.js'
const { MeiGenApiClient } = apiModule
const { runMeiGenGeneration, generationStatusOutput } = operationModule
const { GenerationError, errorOutput } = contractModule
const { streamResponseToFile, withHttpResponse } = httpModule
const { ComfyUIProvider } = comfyModule
const config = { meigenBaseUrl: 'https://api.example', meigenApiToken: 'fixture-key', uploadGatewayUrl: 'https://upload.example' }
async function isolated(run) {
  const directory = await mkdtemp(join(tmpdir(), 'meigen-runtime-recovery-'))
  const previous = { fetch: globalThis.fetch, store: process.env.MEIGEN_REQUEST_STORE_DIR, video: process.env.MEIGEN_VIDEO_OUTPUT_DIR }
  process.env.MEIGEN_REQUEST_STORE_DIR = join(directory, 'receipts')
  process.env.MEIGEN_VIDEO_OUTPUT_DIR = join(directory, 'video')
  try { await run(directory) } finally {
    globalThis.fetch = previous.fetch
    for (const [key, value] of [['MEIGEN_REQUEST_STORE_DIR', previous.store], ['MEIGEN_VIDEO_OUTPUT_DIR', previous.video]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
    await rm(directory, { recursive: true, force: true })
  }
}
const client = () => new MeiGenApiClient(config)
const completed = { success: true, status: 'completed', generationId: 'accepted-job', imageUrl: 'https://images.meigen.ai/ready.png', mediaType: 'image' }

test('explicit requestId with no local receipt recovers remotely before re-uploading any references', () => isolated(async directory => {
  const source = join(directory, 'source.png')
  await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toFile(source)
  const calls = []
  globalThis.fetch = async url => { calls.push(String(url)); assert.match(String(url), /\/requests\//); return Response.json(completed) }
  const output = await runMeiGenGeneration('image', { prompt: 'recover original request', referenceImages: [source], requestId: randomUUID(), wait: false }, client(), config)
  assert.equal(output.generationId, 'accepted-job'); assert.equal(output.deduped, true); assert.equal(calls.length, 1)
}))

test('unavailable receipt storage falls back safely, retains memory identity, and revalidates backend on retry', () => isolated(async directory => {
  await writeFile(process.env.MEIGEN_REQUEST_STORE_DIR, 'occupied by a regular file')
  let accepted = false; let posts = 0; let gets = 0
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/requests/')) { gets++; return accepted ? Response.json(completed) : Response.json({ success: false, code: 'request_not_found' }, { status: 404 }) }
    posts++; assert.equal(init.method, 'POST'); accepted = true; return Response.json({ success: true, generationId: 'accepted-job' })
  }
  const input = { prompt: 'one paid image', requestId: randomUUID(), wait: false }
  const first = await runMeiGenGeneration('image', input, client(), config)
  assert.equal(first.success, true); assert.match(first.receiptWarning, /bounded memory cache/)
  assert.equal((await runMeiGenGeneration('image', input, client(), config)).generationId, 'accepted-job')
  assert.equal((await runMeiGenGeneration('image', { ...input, prompt: 'different' }, client(), config)).error.code, 'idempotency_conflict')
  assert.equal(posts, 1); assert.equal(gets, 2)
  assert.equal(await readFile(process.env.MEIGEN_REQUEST_STORE_DIR, 'utf8'), 'occupied by a regular file')
  assert.deepEqual(await readdir(directory), ['receipts'])
}))

test('unavailable local storage never turns an inconclusive backend lookup into a paid POST', () => isolated(async () => {
  await writeFile(process.env.MEIGEN_REQUEST_STORE_DIR, 'occupied')
  const calls = []; const requestId = randomUUID()
  globalThis.fetch = async (url, init) => { calls.push(init.method ?? 'GET'); return Response.json({ success: false, code: 'temporarily_unavailable', retryable: true }, { status: 503 }) }
  const output = await runMeiGenGeneration('image', { prompt: 'recover', requestId, wait: false }, client(), config)
  assert.deepEqual(calls, ['GET']); assert.equal(output.requestId, requestId); assert.match(output.receiptWarning, /check_generation/)
  assert.equal(output.nextAction.type, 'check_generation')
}))

test('corrupted private identity remains fail-closed instead of being replaced by the memory fallback', () => isolated(async () => {
  globalThis.fetch = async url => String(url).includes('/requests/') ? Response.json({ success: false, code: 'request_not_found' }, { status: 404 }) : Response.json({ success: true, generationId: 'accepted-job' })
  const input = { prompt: 'original', requestId: randomUUID(), wait: false }
  await runMeiGenGeneration('image', input, client(), config)
  const [scope] = await readdir(process.env.MEIGEN_REQUEST_STORE_DIR)
  const identity = join(process.env.MEIGEN_REQUEST_STORE_DIR, scope, input.requestId, 'identity.json')
  await writeFile(identity, '{invalid')
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected') }
  const output = await runMeiGenGeneration('image', input, client(), config)
  assert.equal(output.error.code, 'invalid_receipt'); assert.equal(calls, 0); assert.equal(await readFile(identity, 'utf8'), '{invalid')
}))

test('a receipt save failure after acceptance preserves success and the server handle', () => isolated(async () => {
  globalThis.fetch = async url => {
    if (String(url).includes('/requests/')) return Response.json({ success: false, code: 'request_not_found' }, { status: 404 })
    await rm(process.env.MEIGEN_REQUEST_STORE_DIR, { recursive: true })
    await writeFile(process.env.MEIGEN_REQUEST_STORE_DIR, 'storage became unavailable')
    return Response.json({ success: true, generationId: 'saved-server-job' })
  }
  const output = await runMeiGenGeneration('image', { prompt: 'submit once', requestId: randomUUID(), wait: false }, client(), config)
  assert.equal(output.success, true); assert.equal(output.generationId, 'saved-server-job'); assert.match(output.receiptWarning, /durable receipts are unavailable/)
}))

test('server observation exhaustion returns processing + observationEnded without claiming failure or refund', () => isolated(async () => {
  globalThis.fetch = async url => String(url).includes('/requests/') ? Response.json({ success: false, code: 'request_not_found' }, { status: 404 })
    : String(url).includes('/status/') ? Response.json({ success: true, status: 'processing', pollHintSeconds: 0, generationId: 'observed-job' })
    : Response.json({ success: true, generationId: 'observed-job' })
  const output = await runMeiGenGeneration('image', { prompt: 'wait', requestId: randomUUID(), download: false }, client(), config)
  assert.equal(output.success, true); assert.equal(output.status, 'processing'); assert.equal(output.observationEnded, true); assert.equal(output.pollAfterSeconds, undefined)
  assert.equal(output.error, undefined); assert.equal(output.generationId, 'observed-job'); assert.match(output.nextAction.message, /not proof of failure or refund/)
}))

test('specific generation failure codes survive status queries and deduped submission results', () => isolated(async () => {
  const failed = { success: true, status: 'failed', generationId: 'failed-job', failureCode: 'content_policy_violation', error: 'Rejected', creditsStatus: 'refunded' }
  globalThis.fetch = async () => Response.json(failed)
  const output = await runMeiGenGeneration('image', { prompt: 'failed request', requestId: randomUUID(), wait: false }, client(), config)
  assert.equal(output.error.code, 'content_policy_violation'); assert.equal(output.creditsStatus, 'refunded')
  const terminal = generationStatusOutput(failed, { pollAfterSeconds: 30, observationEnded: true }); assert.equal(terminal.error.code, 'content_policy_violation'); assert.equal(terminal.pollAfterSeconds, undefined); assert.equal(terminal.observationEnded, undefined)
}))

test('HTTP 402 recovery directs BYOK to its own provider and MeiGen to purchased credits', () => {
  const error = new GenerationError('Payment required', 'http_402', 402, true)
  const byok = errorOutput(error, { provider: 'openai' })
  assert.equal(byok.nextAction.type, 'configure_provider_billing'); assert.doesNotMatch(byok.nextAction.message, /meigen.ai\/profile|same requestId/)
  assert.equal(errorOutput(error, { provider: 'meigen', requestId: randomUUID() }).nextAction.type, 'top_up')
  for (const status of [401, 403]) {
    const auth = errorOutput(new GenerationError('Wrong key', 'auth', status), { provider: 'openai' })
    assert.equal(auth.nextAction.type, 'configure_auth'); assert.doesNotMatch(auth.nextAction.message, /same requestId/)
  }
})

test('streamed result writes publish only complete files and clean partial files after overflow, error or cancellation', () => isolated(async directory => {
  const output = join(directory, 'video.mp4')
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])]
  const response = new Response(new ReadableStream({ pull(controller) { const part = chunks.shift(); if (part) controller.enqueue(part); else controller.close() } }))
  response.arrayBuffer = () => { throw new Error('must not buffer whole video') }
  await streamResponseToFile(response, output, 4)
  assert.deepEqual(await readFile(output), Buffer.from([1, 2, 3, 4])); if(process.platform !== 'win32') assert.equal((await stat(output)).mode & 0o777, 0o600)
  await assert.rejects(streamResponseToFile(new Response(''), join(directory, 'empty.mp4'), 4), error => error.code === 'invalid_response')
  assert.deepEqual(await readdir(directory), ['video.mp4'])
  for (const kind of ['overflow', 'error', 'cancel']) {
    const controller = new AbortController(); let step = 0
    const stream = new ReadableStream({ pull(target) {
      if (step++ === 0) return target.enqueue(new Uint8Array([5, 6]))
      if (kind === 'error') return target.error(new Error('network disconnected'))
      if (kind === 'cancel') { controller.abort(); return }
      target.enqueue(new Uint8Array(8)); target.close()
    } })
    await assert.rejects(streamResponseToFile(new Response(stream), join(directory, `${kind}.mp4`), 4, controller.signal))
    assert.deepEqual(await readdir(directory), ['video.mp4'])
  }
}))

test('streamed video timeouts clean partial files and successful generation retains URLs after download failure', () => isolated(async directory => {
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])) } }))
  await assert.rejects(withHttpResponse('https://images.meigen.ai/stall.mp4', {}, 10, (response, signal) => streamResponseToFile(response, join(directory, 'stall.mp4'), 10, signal)), /timed out/)
  assert.deepEqual(await readdir(directory), [])
  for (const mode of ['oversized', 'empty']) {
    globalThis.fetch = async url => {
      if (String(url).includes('/requests/')) return Response.json({ success: false, code: 'request_not_found' }, { status: 404 })
      if (String(url).endsWith('/v2')) return Response.json({ success: true, status: 'completed', generationId: 'video-job', mediaType: 'video', videoUrl: 'https://images.meigen.ai/video.mp4' })
      return mode === 'empty' ? new Response('') : new Response(null, { headers: { 'content-length': String(513 * 1024 * 1024) } })
    }
    const output = await runMeiGenGeneration('video', { prompt: 'video', modelId: 'video', requestId: randomUUID() }, client(), config)
    assert.equal(output.success, true); assert.equal(output.generationId, 'video-job'); assert.equal(output.videoUrl, 'https://images.meigen.ai/video.mp4')
    assert.match(output.downloadWarning, mode === 'empty' ? /empty/ : /size limit/); assert.deepEqual(await readdir(process.env.MEIGEN_VIDEO_OUTPUT_DIR), [])
  }
}))

const workflow = { '1': { class_type: 'CLIPTextEncode', inputs: { text: 'original' } }, '2': { class_type: 'SaveImage', inputs: {} } }
async function comfyScenario(historyResponse, signal, shortDeadline = false) {
  const previous = { fetch: globalThis.fetch, timeout: globalThis.setTimeout }
  let polls = 0; let posts = 0
  // Preserve HTTP deadline behavior while compressing only the fixed polling delay.
  globalThis.setTimeout = (callback, delay, ...args) => previous.timeout(callback, delay === 2000 || (shortDeadline && delay === 15000) ? 0 : delay, ...args)
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/prompt')) { posts++; return Response.json({ prompt_id: 'queued-job' }) }
    polls++; return historyResponse(polls, init)
  }
  try { return { result: await new ComfyUIProvider('http://localhost:8188').generate(workflow, 'draw', { download: false, signal }), polls, posts } }
  finally { globalThis.fetch = previous.fetch; globalThis.setTimeout = previous.timeout }
}
const readyHistory = () => Response.json({ 'queued-job': { status: { completed: true, status_str: 'success' }, outputs: { '2': { images: [{ filename: 'output.png', subfolder: '', type: 'output' }] } } } })

test('ComfyUI retries transient history failures without resubmitting its workflow', async () => {
  for (const fail of [() => new Response(null, { status: 502 }), () => { throw new TypeError('fetch failed') }, () => new Response('oversized', { headers: { 'content-length': String(3 * 1024 * 1024) } })]) {
    const output = await comfyScenario(count => count === 1 ? fail() : readyHistory())
    assert.equal(output.polls, 2); assert.equal(output.posts, 1); assert.match(output.result.imageUrl, /\/view\?/)
  }
})

test('ComfyUI stops after three consecutive query failures and treats actual failure/cancellation as terminal', async () => {
  let polls = 0
  await assert.rejects(comfyScenario(() => { polls++; return new Response(null, { status: 502 }) }), /existing job|existing.*workflow/)
  assert.equal(polls, 3)
  polls = 0
  await assert.rejects(comfyScenario(() => { polls++; return Response.json({ 'queued-job': { status: { completed: false, status_str: 'error' } } }) }), /generation failed/)
  assert.equal(polls, 1)
  polls = 0
  const controller = new AbortController()
  await assert.rejects(comfyScenario((_count, init) => { polls++; controller.abort(); throw init.signal.reason }, controller.signal), error => error.name === 'AbortError')
  assert.equal(polls, 1)
})


test('ComfyUI tolerates a query timeout, resets consecutive errors after a valid poll, and stops on 403', async () => {
  const resumed = await comfyScenario((count, init) => count === 1 ? new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) : readyHistory(), undefined, true)
  assert.equal(resumed.polls, 2); assert.equal(resumed.posts, 1)
  const reset = await comfyScenario(count => [1, 3].includes(count) ? new Response(null, { status: 502 }) : count === 2 ? Response.json({}) : readyHistory())
  assert.equal(reset.polls, 4); assert.equal(reset.posts, 1)
  let polls = 0
  await assert.rejects(comfyScenario(() => { polls++; return new Response(null, { status: 403 }) }), error => error.httpStatus === 403)
  assert.equal(polls, 1)
})
