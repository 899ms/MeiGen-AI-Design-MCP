/**
 * MeiGen MCP Server core
 * Registers all tools and configures the server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from './config.js'
import { MeiGenApiClient } from './lib/meigen-api.js'
import { registerEnhancePrompt } from './tools/enhance-prompt.js'
import { registerSearchGallery } from './tools/search-gallery.js'
import { registerListModels } from './tools/list-models.js'
import { registerGetInspiration } from './tools/get-inspiration.js'
import { registerCheckGeneration } from './tools/check-generation.js'
import { registerGenerateImage } from './tools/generate-image.js'
import { registerGenerateVideo } from './tools/generate-video.js'
import { registerComfyuiWorkflow } from './tools/comfyui-workflow.js'
import { registerSkillTools } from './tools/skills.js'
import { registerManagePreferences } from './tools/manage-preferences.js'
import { SKILL_ACCOUNT_GUIDE, SKILL_FLOW } from './lib/skill-guidance.js'

const SERVER_INSTRUCTIONS = `MeiGen provides image and video tools that can be composed inside any host workflow. The caller owns the overall task, creative plan, scheduling, approvals and presentation. These instructions describe using MeiGen tools; they do not replace the host's role or control unrelated conversation.

## Respect the caller's plan

- Preserve supplied prompts, model/provider choices, aspect ratio, references, quality and output count. Do not rewrite a short prompt, load saved preferences, search for inspiration, spawn agents or add variants unless requested or needed to resolve a missing input. Defaults apply only to omitted values.
- An explicit user request or an authorized upstream workflow already establishes its count, scope and budget. Do not ask again for each image, video, batch or dependent step within that scope. Ask only for missing required inputs or a new decision outside the approved scope, such as higher spending, a replacement attempt, or an unaccepted resize tradeoff. Do not add paid outputs.
- Discovery tools (list_models, list_skills, search_gallery, get_inspiration) can support any workflow. Use live model capabilities and prices when selecting or validating settings; a named model or price in older text is not authoritative. Preserve a valid caller-selected model/provider; omission uses the configured/platform default.
- Return task handles, status, errors and actual result URLs to the caller. The caller decides when to show previews, download outputs or summarize results. Do not force end-user questions, progress messages or a final presentation at intermediate steps. Visual inspection is allowed when the host can actually inspect the image; never invent what an uninspected result looks like.

## Ordinary image and video tasks

- generate_image creates an image; generate_video creates a clip. For video, a model is required. Use list_models for supported duration, tier, resolution and reference inputs. A first-frame image is passed as firstFrame, not referenceImages; lastFrame requires firstFrame. Reference-video continuation produces new footage only, not a concatenated edit.
- For composed MeiGen jobs, persist a caller-generated UUID requestId and the exact inputs for every logical image/video step before calling the tool. Use wait=false to submit and return a task handle, and download=false on local npm when only URLs are needed. wait=true and download=true remain the local legacy defaults; download is skipped when wait=false. Remote MCP returns URLs without local downloads. Use the installed tool schema for transport-specific fields and non-MeiGen provider support.
- Recover with check_generation using the original generationId or requestId. Follow structured status, nextAction and polling hints. A processing/unknown/error response is not a completed artifact. A timeout or transport failure is not permission to create a new request ID. Verify the original attempt before any retry; preserve its ID and inputs. An input conflict must not be bypassed by silently generating a new ID.
- Schedule independent, already-authorized jobs with bounded concurrency. Local npm permits at most four API submissions at once; polling/downloads do not occupy those submission slots. Its ComfyUI executor runs one job at a time. These are local controls, not a promise about backend capacity. Respect actual rate-limit responses and Retry-After. There is no blanket prohibition on parallel videos or a ten-image workflow limit.
- Budget tracking belongs to the caller: reserve the expected cost of all in-flight steps before starting another, reconcile returned charges/refunds, and stop before exceeding agreed scope. Model estimates do not create an atomic server-side batch spending cap; a multi-step workflow may partially succeed.

## Dedicated MeiGen Skills

For transparent cutouts, ecommerce detail images, posters, replacement backgrounds or original-image enhancement, use remove_background, generate_product_detail_images, generate_marketing_poster, generate_ai_background or upscale_image as appropriate. These workflows do not need generic prompt enhancement, preference loading or agent delegation. They require MeiGen credentials and purchased credits; other configured providers cannot run them. Actual local files and public direct HTTPS image URLs are prepared by the applicable tool. If the host cannot read an attachment, request an accessible image URL instead of inventing a path or base64.

${SKILL_FLOW}

Use the original imageUrl for upscale_image (PNG/JPEG/WebP, at most 64 MiB / 64 MP); do not route it through ordinary compressed-reference preparation. Local npm accepts original paths via its dedicated upload path. Default mode is crisp; creative regenerates detail. allowDownscale is false unless the caller has accepted resizing to at most 4096px / 16 MP and the possibility of output smaller than the original. Handle upscale_resize_required and price_changed through their nextAction; changed accepted inputs require a new requestId. Enhancement is for still images, not video.

## Connection and account setup

${SKILL_ACCOUNT_GUIDE.authentication} Create keys: ${SKILL_ACCOUNT_GUIDE.apiKeysUrl}. ${SKILL_ACCOUNT_GUIDE.credits} Top up: ${SKILL_ACCOUNT_GUIDE.topUpUrl}; mobile: ${SKILL_ACCOUNT_GUIDE.mobileTopUpUrl}.

Remote Streamable HTTP uses https://www.meigen.ai/api/mcp with Authorization: Bearer <MeiGen API key> in private host connection settings. Local npm uses npx -y meigen@2.0.0 with MEIGEN_API_TOKEN in the MCP server environment or existing private ~/.config/meigen/config.json. Reconnect after changes. Never request or expose credentials in chat. Only the Claude Code plugin adds /meigen:setup.

Public discovery does not require a key. Local prompt enhancement and preferences do not require a MeiGen key either. Discovery success verifies connectivity, not paid credentials or balance. For ordinary image generation, use the caller's configured MeiGen, OpenAI-compatible or ComfyUI provider.

## Optional creative assistance

When the user asks MeiGen to develop an idea, help with relevant references, prompt crafting and alternatives. Load preferences only when requested or useful to that creative brief, and preserve explicit current choices. Ask about unresolved creative decisions without re-approving an already specified count/budget. This creative assistance is optional; a supplied script, prompt or upstream plan can call generation directly.

For a failed task, return the actionable error and reported billing state to the caller. Do not automatically rewrite prompts, switch providers/models or create paid replacements. Report refunds only when confirmed. The host's workflow decides the next authorized action.`

export function createServer(config = loadConfig()) {
  const apiClient = new MeiGenApiClient(config)

  const server = new McpServer(
    { name: 'meigen', version: '2.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )

  registerSkillTools(server, config)

  // Free features (no configuration required)
  registerEnhancePrompt(server)
  registerSearchGallery(server, config)
  registerListModels(server, apiClient, config)
  registerGetInspiration(server, apiClient)
  registerCheckGeneration(server, apiClient)
  registerManagePreferences(server)

  // ComfyUI workflow management
  registerComfyuiWorkflow(server, config)

  // Image generation (requires API Key, MeiGen Token, or ComfyUI workflow)
  registerGenerateImage(server, apiClient, config)

  // Video generation (requires MeiGen Token)
  registerGenerateVideo(server, apiClient, config)

  return server
}
