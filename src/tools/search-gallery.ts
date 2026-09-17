import { searchPreviewUrl } from '../lib/search-media.js'
/**
 * search_gallery Tool — free, no auth required
 * Semantic search via website API (vector + keyword hybrid), with local fallback
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MeiGenConfig } from '../config.js'
import {
  searchPrompts,
  getRandomPrompts,
  getLibraryStats,
} from '../lib/prompt-library.js'
import { apiSearchPosts, type ApiSearchResult } from '../lib/api-search.js'

/** Hard ceiling on returned entries. The schema still accepts up to 20 so that automations
 *  written against the old max keep working — rejecting them outright would be a schema error
 *  before the tool ever runs, which no caller can recover from. */
const MAX_RESULTS = 3

export const searchGallerySchema = {
  query: z.string().optional()
    .describe('Search keywords (e.g., "cyberpunk", "product photo", "portrait"). Supports semantic search — natural language descriptions work well. Leave empty to browse by category or get random picks.'),
  category: z.enum(['Photography', 'Illustration & 3D', 'Product & Brand', 'Food & Drink', 'Poster Design', 'UI & Graphic']).optional()
    .describe('Filter by category. Available: Photography, Illustration & 3D, Product & Brand, Food & Drink, Poster Design, UI & Graphic'),
  limit: z.number().min(1).max(20).optional().default(3)
    .describe('Requested number of results. The server returns at most 3; larger values from existing automations are accepted and clamped rather than rejected.'),
  offset: z.number().min(0).optional().default(0)
    .describe('Pagination offset'),
  sortBy: z.enum(['rank', 'likes', 'views', 'date']).optional().default('rank')
    .describe('Sort order when browsing without search query (default: rank)'),
}

export function registerSearchGallery(server: McpServer, config: MeiGenConfig) {
  server.tool(
    'search_gallery',
    'Search AI image prompts with semantic understanding — finds visually and conceptually similar results, not just keyword matches. Returns at most 3 entries per call; larger limits are clamped. With a MeiGen API key configured, searches are authenticated and counted against that account\'s daily search quota instead of the shared per-IP budget. Results include image URLs — render them as markdown images (![](url)) so users can visually browse and pick styles. Use when users need inspiration, want to explore styles, or say "generate an image" without a specific idea.',
    searchGallerySchema,
    { readOnlyHint: true },
    async ({ query, category, limit, offset, sortBy }) => {
      const resultLimit = Math.min(limit ?? MAX_RESULTS, MAX_RESULTS)
      // No search criteria — return random picks from local library
      if (!query && !category && offset === 0) {
        const random = getRandomPrompts(resultLimit)
        const stats = getLibraryStats()
        const header = `Curated Prompt Library: ${stats.total} trending prompts\nCategories: ${Object.entries(stats.categories).map(([k, v]) => `${k} (${v})`).join(', ')}\n\nHere are ${resultLimit} random picks — show the preview images to the user:\n`
        return {
          content: [{
            type: 'text' as const,
            text: header + formatLocalResults(random),
          }],
        }
      }

      // 带 key 时账户每日额度用尽:先说清楚(与远程 MCP 同一套措辞),再把打包库的结果给出去 ——
      // 这堵墙要到 UTC 次日才拆,不是 2026-08-05 那条「限流是短时态,不降级」决定针对的情况。
      let dailyLimitNotice = ''
      // Has query and no category filter → try semantic search via API
      if (query && query.trim() && !category) {
        // A configured key turns this into an account-scoped search: the daily quota is charged
        // to the account rather than to whatever IP the host happens to share.
        const outcome = await apiSearchPosts(config.meigenBaseUrl, query, resultLimit, offset, config.meigenApiToken)
        if (outcome.kind === 'rate-limited') {
          // 明确告知而非静默降级到打包快照:限流是短时态,过时数据更误导
          return {
            content: [{
              type: 'text' as const,
              text: 'Search is rate-limited right now (too many requests from this network). Please retry in about a minute — results will be fresher than the bundled offline library.',
            }],
          }
        }
        if (outcome.kind === 'daily-limit') {
          dailyLimitNotice = "This account's daily gallery search allowance is used up; it resets at 00:00 UTC. Showing the bundled offline library below — browse https://www.meigen.ai directly for fresh results.\n\n"
        }
        if (outcome.kind === 'ok' && outcome.results.length > 0) {
          const text = `Found ${outcome.results.length} results for "${query}" (semantic search):\n\n${formatApiResults(outcome.results)}\n\nShow the preview images above to the user so they can visually browse. Use get_inspiration(imageId) to get the full prompt and all images for any entry the user likes.`
          return {
            content: [{
              type: 'text' as const,
              text,
            }],
          }
        }
        // API unavailable or no results — fall through to local (bundled) search
      }

      // Local search (keyword-based): with category filter, or as API fallback
      const results = searchPrompts({ query, category, limit: resultLimit, offset, sortBy })

      if (results.length === 0) {
        const suggestion = category
          ? `No results for "${query || ''}" in category "${category}". Try a different keyword or remove the category filter.`
          : `No results for "${query}". Try broader keywords like "portrait", "landscape", "product", "anime".`
        return {
          content: [{
            type: 'text' as const,
            text: dailyLimitNotice + suggestion,
          }],
        }
      }

      const searchDesc = [
        query ? `"${query}"` : null,
        category ? `category: ${category}` : null,
      ].filter(Boolean).join(', ')

      const text = `${dailyLimitNotice}Found ${results.length} results${searchDesc ? ` for ${searchDesc}` : ''}:\n\n${formatLocalResults(results)}\n\nShow the preview images above to the user so they can visually browse. Use get_inspiration(imageId) to get the full prompt and all images for any entry the user likes.`

      return {
        content: [{
          type: 'text' as const,
          text,
        }],
      }
    }
  )
}

function formatApiResults(results: ApiSearchResult[]): string {
  return results.map((item, i) => {
    // Use text field as prompt, truncate for preview
    const promptText = item.text || ''
    const promptPreview = promptText.length > 150
      ? promptText.slice(0, 150).replace(/\n/g, ' ') + '...'
      : promptText.replace(/\n/g, ' ')

    const imageUrl = searchPreviewUrl(item)
    const author = item.author_display_name || item.author_username || 'Unknown'
    const model = item.model || 'unknown'

    const parts = [
      `${i + 1}. by ${author} — ${model}`,
      imageUrl ? `   ![Preview](${imageUrl})` : null,
      `   Prompt: ${promptPreview}`,
      `   Stats: ${item.likes} likes, ${item.views.toLocaleString()} views`,
      `   ID: ${item.id}`,
    ].filter(Boolean)
    return parts.join('\n')
  }).join('\n\n')
}

function formatLocalResults(results: ReturnType<typeof searchPrompts>): string {
  return results.map((item, i) => {
    // Truncate prompt to first 150 chars for preview
    const promptPreview = item.prompt.length > 150
      ? item.prompt.slice(0, 150).replace(/\n/g, ' ') + '...'
      : item.prompt.replace(/\n/g, ' ')

    const parts = [
      `${i + 1}. **#${item.rank}** by ${item.author_name} — ${item.categories.join(', ')}`,
      `   ![Preview #${item.rank}](${item.image})`,
      `   Prompt: ${promptPreview}`,
      `   Stats: ${item.likes} likes, ${item.views.toLocaleString()} views`,
      `   ID: ${item.id}`,
    ]
    return parts.join('\n')
  }).join('\n\n')
}
