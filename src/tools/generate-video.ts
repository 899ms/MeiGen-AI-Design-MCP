/**
 * generate_video Tool — MeiGen-only, requires authentication
 * Wraps the same /api/generate/v2 endpoint with video-specific parameters.
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenConfig } from '../config.js'
import type { MeiGenApiClient } from '../lib/meigen-api.js'
import { generationControls, generationOutputSchema, generationResult, errorOutput, GenerationError } from '../lib/generation-contract.js'
import { runMeiGenGeneration } from '../lib/generation-operation.js'

export const generateVideoSchema = {
  ...generationControls,
  prompt: z.string().trim().min(1, 'Prompt cannot be empty').describe('The video generation prompt. Describe motion, scene, and style — not just the still image.'),
  modelId: z.string().trim().min(1).optional().describe('Alias of model. Provide at least one; both must match when supplied.'),
  model: z.string().trim().min(1).optional().describe('Video model ID. REQUIRED; call list_models for the live lineup and capabilities.'),
  tier: z.string().optional()
    .describe('Optional model tier. Use list_models for the selected model\'s live tier values.'),
  duration: z.number().int().positive().optional()
    .describe('Video duration in seconds. Use list_models for the model\'s enum/range; when omitted the server uses the omitted-request default shown there.'),
  resolution: z.string().optional()
    .describe('Output resolution. Use list_models for the selected model/tier\'s live values.'),
  aspectRatio: z.string().optional()
    .describe('Aspect ratio: "16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "auto", "adaptive" (model-dependent). Defaults to "auto" when omitted.'),
  firstFrame: z.string().optional()
    .describe('First-frame image when required or supported by the selected model. Accepts a public URL or local file path (auto-uploaded); use list_models and let the server enforce the live model contract.'),
  lastFrame: z.string().optional()
    .describe('Optional last-frame image for a model that supports it. Accepts a public URL or local file path; requires firstFrame. Use list_models for the live model contract.'),
  referenceVideo: z.string().optional()
    .describe(
      'Optional reference video URL for a model that advertises reference-video support in list_models. Must be a MeiGen video URL on images.meigen.ai (a previous generation result `videoUrl`, or a clip uploaded via meigen.ai) — other domains are rejected because billing metadata must be verifiable; local paths are not supported. ' +
      'IMPORTANT — prompt requirement: to make the new clip semantically continue the reference, the `prompt` MUST explicitly say "extend" / "continue" (e.g. prefix with "Extend this video with the following plot:"). Without that, the model treats the video as visual reference only and the new clip may drift from a true continuation. ' +
      'Output behavior: the output is only the configured `duration` of new content — the reference video is not concatenated into the output. ' +
      'Billing may include the reference clip and model-specific minimums. The server probes authoritative MP4 duration; do not estimate billing from client metadata.'
    ),
  referenceVideoDuration: z.number().int().positive().optional()
    .describe('Deprecated compatibility hint. Ignored because the server probes authoritative MP4 duration.'),
}

export function registerGenerateVideo(server: McpServer, apiClient: MeiGenApiClient, config: MeiGenConfig) {
  server.registerTool('generate_video', {
    description: 'Generate a MeiGen video using a required live model ID from list_models. Preserve the caller’s resolved prompt, parameters and authorized scope. Set requestId, wait=false and download=false for workflow submission; then query check_generation. At most four submissions run concurrently per MCP process; the backend quota and Retry-After remain authoritative. Video generation consumes purchased credits.',
    inputSchema: generateVideoSchema, outputSchema: generationOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async ({ prompt, model, modelId, tier, duration, resolution, aspectRatio, firstFrame, lastFrame, referenceVideo, referenceVideoDuration, requestId, wait = true, download = true }, extra) => {
    if (!model && !modelId) return generationResult(errorOutput(new GenerationError('A video model or modelId from list_models is required.', 'model_required')))
    if (model && modelId && model !== modelId) return generationResult(errorOutput(new GenerationError('model and modelId must match when both are provided.', 'model_alias_conflict')))
    model = model ?? modelId
    if (lastFrame && !firstFrame) return generationResult(errorOutput(new GenerationError('lastFrame requires firstFrame.', 'invalid_reference'), { requestId, mediaType: 'video', provider: 'meigen' }))
    if (referenceVideoDuration !== undefined && !referenceVideo) return generationResult(errorOutput(new GenerationError('referenceVideoDuration requires referenceVideo; the backend measures its actual duration.', 'invalid_reference'), { requestId, mediaType: 'video', provider: 'meigen' }))
    return generationResult(await runMeiGenGeneration('video', {
      prompt, modelId: model, tier, duration, resolution, aspectRatio,
      referenceImages: [firstFrame, lastFrame].filter((value): value is string => Boolean(value)),
      referenceVideo, requestId, wait, download,
    }, apiClient, config, extra.signal, async message => {
      try { await extra.sendNotification({ method: 'notifications/message', params: { level: 'info', logger: 'generate_video', data: message } }) } catch { /* Hosts may not implement logging. */ }
    }))
  })
}
