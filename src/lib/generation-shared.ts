/**
 * Shared utilities between generate_image and generate_video tools.
 * Both hit the same backend endpoint (/api/generate/v2) and share the
 * backend submission quota. Polling and result downloads do not hold submission slots.
 */

import { Semaphore } from './semaphore.js'
import type { ProviderType } from '../config.js'

// At most four in-flight submissions per process. This is NOT a per-minute rate
// limiter; the backend is authoritative and Retry-After is returned to the caller.
export const sharedApiSemaphore = new Semaphore(4)

/** Translate a raw provider/network error message into actionable user guidance. */
export function classifyError(message: string, provider?: ProviderType): string {
  const lower = message.toLowerCase()

  if (lower.includes('safety') || lower.includes('policy') || lower.includes('flagged') || lower.includes('content_blocked') || lower.includes('moderation'))
    return 'The prompt may have triggered a content safety filter. Try rephrasing the prompt to avoid sensitive content.'

  if (lower.includes('credit') || lower.includes('balance') || /\b402\b/.test(message) || /insufficient\s+(funds|quota)/.test(lower)) {
    if (provider === 'meigen') return 'Insufficient purchased credits. API calls do not use daily free credits. Top up the same MeiGen account at https://www.meigen.ai/profile (mobile: https://www.meigen.ai/m/premium).'
    if (provider === 'openai') return 'Check the balance, billing and quota of the provider configured by OPENAI_BASE_URL and OPENAI_API_KEY. MeiGen credits do not pay for this OpenAI-compatible provider.'
    if (provider === 'comfyui') return 'Check the ComfyUI workflow and any paid external service used by its custom nodes.'
    return 'Check the selected generation provider’s account balance, billing and quota.'
  }

  if (lower.includes('timed out') || lower.includes('timeout'))
    return 'Generation timed out. This can happen during high demand. You can try again — it may succeed on retry.'

  if (lower.includes('rate') && (lower.includes('limit') || message.includes('429')))
    return 'Too many requests. Wait a moment and try again.'

  if (lower.includes('model') && (lower.includes('invalid') || lower.includes('inactive')))
    return 'This model may be unavailable. Use list_models to check currently available models.'

  if (lower.includes('ratio') && lower.includes('not supported'))
    return 'This aspect ratio is not supported by the selected model. Use list_models to check supported ratios, or omit aspectRatio to let the server auto-infer.'

  if ((lower.includes('token') || lower.includes('api key')) && (lower.includes('invalid') || lower.includes('expired'))) {
    if (provider === 'openai') return 'Update the API key for your configured OpenAI-compatible provider in local credentials settings, then reconnect.'
    return 'Update the selected provider’s key in local connection settings, then reconnect. For MeiGen, create a key at https://www.meigen.ai/profile/api-keys and set MEIGEN_API_TOKEN. Keep credentials out of chat.'
  }

  if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('network'))
    return 'Network connection issue. Check your internet connection and try again.'

  if (lower.includes('comfyui') || lower.includes('node_errors'))
    return 'ComfyUI workflow error. Use comfyui_workflow view to inspect the workflow, or try a different one.'

  return 'You can try again, or use a different prompt/model.'
}
