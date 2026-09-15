/** Read-only recovery for ordinary MeiGen generations, including lost submit responses. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MeiGenApiClient } from '../lib/meigen-api.js'
import { releaseByGenerationId } from '../lib/attempt-store.js'
import { generationOutputSchema, generationResult, errorOutput, GenerationError, isRequestNotFound } from '../lib/generation-contract.js'
import { generationStatusOutput } from '../lib/generation-operation.js'

export function registerCheckGeneration(server: McpServer, apiClient: MeiGenApiClient) {
  server.registerTool('check_generation', {
    description: 'Read an existing MeiGen job without new charges. Provide generationId OR the caller requestId UUID. requestId lookup works after a lost submit response, process restart or another host. Follow structured status and nextAction; do not turn an uncertain status into a new paid UUID.',
    inputSchema: {
      generationId: z.string().min(1).optional().describe('Accepted generation ID. Provide exactly one of generationId and requestId.'),
      requestId: z.string().uuid().optional().describe('Original workflow step UUID supplied to generate_image/video; authenticated lookup across hosts. Provide exactly one identifier.'),
      requestedMediaType: z.enum(['image', 'video']).optional().describe('Original workflow step intent, when known. Preserve it from nextAction.arguments to detect a completed result of the other media type; this does not change or resubmit the job.'),
    }, outputSchema: generationOutputSchema, annotations: { readOnlyHint: true },
  }, async ({ generationId, requestId, requestedMediaType }, extra) => {
    if (Boolean(generationId) === Boolean(requestId)) return generationResult(errorOutput(new GenerationError('Provide exactly one of generationId and requestId.', 'invalid_identifier')))
    const context = { ...(generationId ? { generationId } : {}), ...(requestId ? { requestId: requestId.toLowerCase() } : {}), ...(requestedMediaType ? { requestedMediaType } : {}) }
    try {
      const status = requestId ? await apiClient.getGenerationByRequestId(requestId.toLowerCase(), extra?.signal) : await apiClient.getGenerationStatus(generationId!, extra?.signal)
      const body = generationStatusOutput(status, context)
      if ((body.status === 'completed' && body.urls.length > 0) || body.status === 'failed') releaseByGenerationId(body.generationId ?? generationId!)
      return generationResult(body)
    } catch (error) {
      const body = errorOutput(error, { provider: 'meigen', ...context })
      if (isRequestNotFound(error) && requestId) {
        body.status = 'unknown'
        body.nextAction = { type: 'retry_request', message: 'No server receipt was found for this requestId. If recovering an interrupted submission, resend the exact original generate_image/video inputs with this same UUID. Do not invent replacement inputs or create a new UUID.' }
      } else if (error instanceof GenerationError && (error.httpStatus === 410 || error.code === 'generation_unavailable' || (error.httpStatus === 404 && generationId))) {
        body.status = 'unknown'
        body.nextAction = { type: 'review_missing', message: 'The original generation is unavailable. Keep the original identifier; verify the ID and account or review the gallery. Stop automatic polling; do not assume a replacement generation is authorized.' }
      } else if (error instanceof GenerationError && error.code === 'in_progress' && error.details.retryAfterSeconds !== 0) {
        body.status = 'processing'; body.pollAfterSeconds = error.details.retryAfterSeconds ?? 5
        body.nextAction = { type: 'check_generation', tool: 'check_generation', arguments: context, afterSeconds: body.pollAfterSeconds }
      }
      return generationResult(body)
    }
  })
}
