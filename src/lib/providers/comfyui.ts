/**
 * ComfyUI Local Provider
 * Template-based workflow: users provide a workflow JSON template,
 * generation fills in prompt/seed/size at runtime.
 */

import { withHttpResponse, boundedJson, boundedBytes, abortableDelay, abortReason, responseError } from '../generation-http.js'
import { GenerationError } from '../generation-contract.js'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

// ============================================================
// Types
// ============================================================

/** ComfyUI API-format workflow — node IDs as keys */
export type ComfyUIWorkflow = Record<string, ComfyUINode>

export interface ComfyUINode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

/** Auto-detected key node mapping — all fields optional (best-effort detection) */
export interface WorkflowNodeMap {
  positivePrompt?: string
  negativePrompt?: string
  sampler?: string
  latentImage?: string
  checkpoint?: string
  saveImage?: string
  loadImages?: string[]
}

/** Workflow summary info */
export interface WorkflowSummary {
  checkpoint?: string
  steps?: number
  cfg?: number
  sampler?: string
  scheduler?: string
  width?: number
  height?: number
  nodeCount: number
}

// ============================================================
// Workflow File Management
// ============================================================

export function getWorkflowsDir(): string {
  return join(homedir(), '.config', 'meigen', 'workflows')
}

export function listWorkflows(): string[] {
  try {
    const dir = getWorkflowsDir()
    const files = readdirSync(dir)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .sort()
  } catch {
    return []
  }
}

export function loadWorkflow(name: string): ComfyUIWorkflow {
  const filePath = join(getWorkflowsDir(), `${name}.json`)
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as ComfyUIWorkflow
}

export function saveWorkflow(name: string, workflow: ComfyUIWorkflow): void {
  const dir = getWorkflowsDir()
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${name}.json`)
  writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8')
}

export function deleteWorkflow(name: string): void {
  const filePath = join(getWorkflowsDir(), `${name}.json`)
  unlinkSync(filePath)
}

export function workflowExists(name: string): boolean {
  return existsSync(join(getWorkflowsDir(), `${name}.json`))
}

// ============================================================
// Workflow Node Detection
// ============================================================

/**
 * Best-effort auto-detection of key nodes. Never throws — returns what it can find.
 * Strategy:
 *   1. Find sampler node (fuzzy match on class_type containing "sampler"/"ksampler")
 *   2. Trace sampler's positive input → find text/prompt node
 *   3. Fallback: search all nodes for any with a direct string `text` input
 *   4. Find LoadImage-like nodes for reference image injection
 */
export function detectNodes(workflow: ComfyUIWorkflow): WorkflowNodeMap {
  const result: WorkflowNodeMap = {}

  // 1. Find sampler (fuzzy: class_type contains "sampler", case-insensitive)
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type.toLowerCase().includes('sampler')) {
      result.sampler = id
      break
    }
  }

  // 2. Trace sampler's positive input → find text/prompt node
  if (result.sampler) {
    const samplerNode = workflow[result.sampler]
    const positiveRef = samplerNode.inputs.positive
    if (Array.isArray(positiveRef) && typeof positiveRef[0] === 'string') {
      const refNode = workflow[positiveRef[0]]
      if (refNode && typeof refNode.inputs.text === 'string') {
        result.positivePrompt = positiveRef[0]
      }
    }
    const negativeRef = samplerNode.inputs.negative
    if (Array.isArray(negativeRef) && typeof negativeRef[0] === 'string') {
      const refNode = workflow[negativeRef[0]]
      if (refNode && typeof refNode.inputs.text === 'string') {
        result.negativePrompt = negativeRef[0]
      }
    }
  }

  // 3. Fallback for prompt: find first node with a direct string `text` input
  if (!result.positivePrompt) {
    for (const [id, node] of Object.entries(workflow)) {
      const text = node.inputs.text
      if (typeof text === 'string' && text.length > 0) {
        result.positivePrompt = id
        break
      }
    }
  }

  // 4. Find LoadImage-like nodes (fuzzy: class_type contains "loadimage")
  const loadImageIds: string[] = []
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type.toLowerCase().includes('loadimage')) {
      loadImageIds.push(id)
    }
  }
  if (loadImageIds.length > 0) result.loadImages = loadImageIds

  // 5. Find checkpoint loader (fuzzy: class_type contains "checkpoint")
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type.toLowerCase().includes('checkpoint')) {
      result.checkpoint = id
      break
    }
  }

  // 6. Find latent image / size node (fuzzy)
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type.toLowerCase().includes('latentimage') ||
        node.class_type.toLowerCase().includes('emptylatent')) {
      result.latentImage = id
      break
    }
  }

  // 7. Find save/output node (fuzzy)
  for (const [id, node] of Object.entries(workflow)) {
    if (node.class_type.toLowerCase().includes('saveimage') ||
        node.class_type.toLowerCase().includes('previewimage')) {
      result.saveImage = id
      break
    }
  }

  return result
}

/** Get workflow summary info */
export function getWorkflowSummary(workflow: ComfyUIWorkflow): WorkflowSummary {
  const summary: WorkflowSummary = {
    nodeCount: Object.keys(workflow).length,
  }

  try {
    const nodes = detectNodes(workflow)

    if (nodes.sampler) {
      const samplerInputs = workflow[nodes.sampler].inputs
      summary.steps = samplerInputs.steps as number | undefined
      summary.cfg = samplerInputs.cfg as number | undefined
      summary.sampler = samplerInputs.sampler_name as string | undefined
      summary.scheduler = samplerInputs.scheduler as string | undefined
    }

    if (nodes.latentImage) {
      const latentInputs = workflow[nodes.latentImage].inputs
      summary.width = latentInputs.width as number | undefined
      summary.height = latentInputs.height as number | undefined
    }

    if (nodes.checkpoint) {
      summary.checkpoint = workflow[nodes.checkpoint].inputs.ckpt_name as string | undefined
    }
  } catch {
    // Return basic info if parsing fails
  }

  return summary
}

/** Show ALL nodes and their editable (non-connection) inputs.
 *  Designed for LLM consumption — the LLM reads this output and decides
 *  which parameters to modify via the "modify" action before generation. */
export function getEditableNodes(workflow: ComfyUIWorkflow): string {
  const lines: string[] = []

  // Mark auto-injected nodes so LLM knows what's handled automatically
  const nodes = detectNodes(workflow)
  const promptNodeId = nodes.positivePrompt
  const loadImageIds = nodes.loadImages || []

  for (const [id, node] of Object.entries(workflow)) {
    const title = node._meta?.title || node.class_type
    const marker =
      id === promptNodeId ? ' ← prompt injected here at generation'
      : loadImageIds.includes(id) ? ' ← reference image injected here'
      : ''

    lines.push(`Node #${id} (${node.class_type}) — ${title}${marker}`)

    for (const [key, val] of Object.entries(node.inputs)) {
      if (Array.isArray(val)) continue // Node connections — not directly editable
      lines.push(`  ${key}: ${JSON.stringify(val)}`)
    }
    lines.push('')
  }

  lines.push('To modify a parameter, use action "modify" with nodeId, input, and value.')
  lines.push('Example: nodeId="3", input="steps", value="30"')

  return lines.join('\n')
}

// ============================================================
// ComfyUI HTTP Client
// ============================================================

interface ComfyUIPromptResponse {
  prompt_id: string
  number: number
  node_errors?: Record<string, unknown>
}

interface ComfyUIHistoryEntry {
  status: { status_str: string; completed: boolean }
  outputs: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>
}

export class ComfyUIProvider {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async checkConnection(signal?: AbortSignal): Promise<{ ok: boolean; error?: string }> {
    try {
      await withHttpResponse(this.baseUrl, {}, 3000, async response => { await response.body?.cancel() }, signal)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** Upload an image to ComfyUI's input directory */
  async uploadImage(imageBuffer: Buffer, filename: string, signal?: AbortSignal): Promise<string> {
    const blob = new Blob([imageBuffer])
    const formData = new FormData()
    formData.append('image', blob, filename)
    formData.append('overwrite', 'true')

    const json = await withHttpResponse(`${this.baseUrl}/upload/image`, { method: 'POST', body: formData }, 30_000, async response => {
      if (!response.ok) throw new Error(`ComfyUI image upload failed (${response.status})`)
      return await boundedJson(response) as { name: string }
    }, signal)
    return json.name
  }

  async listCheckpoints(): Promise<string[]> {
    try {
      return await withHttpResponse(`${this.baseUrl}/models/checkpoints`, {}, 10_000, async response => {
        if (!response.ok) return []
        return JSON.parse((await boundedBytes(response, 2 * 1024 * 1024)).toString('utf8')) as string[]
      })
    } catch {
      return []
    }
  }

  /** Submit a workflow and wait for the result.
   *  Only injects prompt text and reference images — all other workflow
   *  parameters (seed, steps, model, size, etc.) are left as-is in the
   *  template. Use comfyui_workflow modify to adjust them before generating. */
  async generate(
    workflow: ComfyUIWorkflow,
    prompt: string,
    options?: {
      referenceImages?: string[]
      signal?: AbortSignal
      download?: boolean
    },
    onProgress?: (elapsedMs: number) => Promise<void>,
  ): Promise<{ imageBase64: string; mimeType: string; imageUrl?: string; referenceImageWarning?: string }> {
    // 1. Deep-copy the template
    const wf = JSON.parse(JSON.stringify(workflow)) as ComfyUIWorkflow

    // 2. Detect prompt and reference image injection points (best-effort)
    const nodes = detectNodes(wf)

    // 3. Inject prompt — if auto-detection found the node.
    //    If not, the workflow is submitted as-is (LLM should have set
    //    the prompt via comfyui_workflow modify beforehand).
    if (nodes.positivePrompt) {
      wf[nodes.positivePrompt].inputs.text = prompt
    }

    // 4. Handle reference images for LoadImage nodes
    let referenceImageWarning: string | undefined
    if (options?.referenceImages?.length) {
      if (nodes.loadImages?.length) {
        const count = Math.min(options.referenceImages.length, nodes.loadImages.length)
        for (let i = 0; i < count; i++) {
          const source = options.referenceImages[i]
          const nodeId = nodes.loadImages[i]

          let imgBuffer: Buffer
          let ext: string

          if (source.startsWith('http://') || source.startsWith('https://')) {
            // Remote URL: download first
            imgBuffer = await withHttpResponse(source, { redirect: 'error' }, 30_000, async response => {
              if (!response.ok) throw new Error(`Reference download failed (${response.status})`)
              return boundedBytes(response, 32 * 1024 * 1024)
            }, options.signal)
            ext = source.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)?.[1] || 'png'
          } else {
            // Local file path: read directly (skip R2 roundtrip)
            const localPath = source.startsWith('file://') ? source.slice(7) : source
            if (!existsSync(localPath)) {
              throw new Error(`Local reference image not found: ${localPath}`)
            }
            imgBuffer = readFileSync(localPath)
            ext = basename(localPath).match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || 'png'
          }

          // Upload to ComfyUI's input directory
          const filename = `ref_${Date.now()}_${i}.${ext}`
          const uploadedName = await this.uploadImage(imgBuffer, filename, options.signal)

          // Inject into LoadImage node
          wf[nodeId].inputs.image = uploadedName
        }
      } else {
        referenceImageWarning = 'The current workflow has no LoadImage nodes, so reference images were not applied. To use reference images with ComfyUI, import a workflow that includes LoadImage nodes (e.g., an img2img workflow).'
      }
    }

    // 7. Submit workflow
    const { prompt_id, node_errors } = await withHttpResponse(`${this.baseUrl}/prompt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf }),
    }, 30_000, async response => {
      if (!response.ok) throw new Error(`ComfyUI prompt submission failed (${response.status})`)
      return await boundedJson(response) as unknown as ComfyUIPromptResponse
    }, options?.signal)

    if (node_errors && Object.keys(node_errors).length > 0) {
      throw new Error(`ComfyUI node errors: ${JSON.stringify(node_errors)}`)
    }

    // 8. Poll until completed (max 5 minutes)
    const timeoutMs = 300_000
    const pollInterval = 2_000
    const startTime = Date.now()
    let lastProgress = 0
    let consecutiveErrors = 0

    while (Date.now() - startTime < timeoutMs) {
      await abortableDelay(pollInterval, options?.signal)

      const elapsed = Date.now() - startTime
      if (onProgress && elapsed - lastProgress >= 15_000) {
        await onProgress(elapsed)
        lastProgress = elapsed
      }

      let history: Record<string, ComfyUIHistoryEntry>
      try {
        const remainingMs = timeoutMs - (Date.now() - startTime)
        if (remainingMs <= 0) break
        history = await withHttpResponse(`${this.baseUrl}/history/${prompt_id}`, {}, Math.min(15_000, remainingMs), async response => {
          if (!response.ok) throw responseError(response, { error: `ComfyUI history query failed (${response.status}); check the existing job ${prompt_id} before submitting again.` })
          return await boundedJson(response) as unknown as Record<string, ComfyUIHistoryEntry>
        }, options?.signal)
        consecutiveErrors = 0
      } catch (error) {
        abortReason(options?.signal)
        const transient = error instanceof TypeError || (error instanceof GenerationError && (error.retryable || error.code === 'download_too_large'))
        if (!transient) throw error
        if (++consecutiveErrors >= 3) throw new GenerationError(`ComfyUI status could not be read for job ${prompt_id}. Check this existing job in ComfyUI before submitting another workflow.`, 'status_unavailable', 503, false)
        continue
      }
      const entry = history[prompt_id]
      if (!entry) continue

      if (entry.status.status_str === 'error') {
        throw new Error('ComfyUI generation failed')
      }

      if (!entry.status.completed) continue

      // 9. Find output image
      for (const output of Object.values(entry.outputs)) {
        if (output.images && output.images.length > 0) {
          const img = output.images[0]
          const params = new URLSearchParams({
            filename: img.filename,
            subfolder: img.subfolder,
            type: img.type,
          })

          // 10. Download image
          const imageUrl = `${this.baseUrl}/view?${params}`
          if (options?.download === false) return { imageBase64: '', mimeType: 'image/png', imageUrl, referenceImageWarning }
          return await withHttpResponse(imageUrl, {}, 30_000, async response => {
            if (!response.ok) throw new Error(`ComfyUI image download failed (${response.status})`)
            return { imageBase64: (await boundedBytes(response, 64 * 1024 * 1024)).toString('base64'), mimeType: response.headers.get('content-type') || 'image/png', imageUrl, referenceImageWarning }
          }, options?.signal)
        }
      }

      throw new Error('ComfyUI generation completed but no output images found')
    }

    throw new Error(`ComfyUI generation timed out after ${timeoutMs / 1000}s`)
  }
}

// ============================================================
// Aspect Ratio -> Size Conversion
// ============================================================

const ASPECT_RATIOS: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '3:4': [3, 4],
  '4:3': [4, 3],
  '16:9': [16, 9],
  '9:16': [9, 16],
}

/**
 * Calculate new dimensions from aspect ratio, preserving total pixel count.
 * Results are rounded to multiples of 8 (SD model requirement).
 */
export function calculateSize(
  aspectRatio: string,
  originalWidth: number,
  originalHeight: number,
): { width: number; height: number } {
  const ratio = ASPECT_RATIOS[aspectRatio]
  if (!ratio) return { width: originalWidth, height: originalHeight }

  const [rw, rh] = ratio
  const totalPixels = originalWidth * originalHeight
  const newHeight = Math.sqrt(totalPixels * rh / rw)
  const newWidth = newHeight * rw / rh

  return {
    width: Math.round(newWidth / 8) * 8,
    height: Math.round(newHeight / 8) * 8,
  }
}
