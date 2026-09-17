/**
 * Website API search client
 * Calls meigen.ai /api/search for semantic (vector + keyword hybrid) search
 * Falls back gracefully — caller should handle errors and use local search
 */

export interface ApiSearchResult {
  id: string
  text: string
  thumbnail_url: string | null
  media_urls: string[] | null
  matched_media_index?: number | null
  author_username: string | null
  author_display_name: string | null
  likes: number
  views: number
  model: string | null
  prompt_ready: boolean | null
  image_width: number | null
  image_height: number | null
  rank: number
}

interface ApiSearchResponse {
  success: boolean
  data?: ApiSearchResult[]
  error?: string
}

/**
 * Search outcome (2026-08-05): rate-limiting is now surfaced instead of silently
 * falling back to the bundled snapshot — the server added per-IP anti-scrape limits
 * (429), and masking them behind stale local data misleads users.
 * - ok: server results
 * - rate-limited: per-IP window (a minute) — tell the user to retry shortly; do NOT silently degrade
 * - daily-limit: the account's daily allowance is gone until 00:00 UTC — say so, then the bundled
 *   library is the only useful answer for the rest of the day
 * - unavailable: network failure / server error → caller may fall back to local
 */
export type ApiSearchOutcome =
  | { kind: 'ok'; results: ApiSearchResult[] }
  | { kind: 'rate-limited' }
  /** 账户每日搜索额度用尽(带 key 才会出现):UTC 次日 00:00 才重置,不是一分钟后能好的事。 */
  | { kind: 'daily-limit' }
  | { kind: 'unavailable' }

/**
 * Search posts via website API (semantic vector + keyword hybrid search).
 *
 * `apiToken` is optional: anonymous callers share the per-IP anti-scrape budget, while a
 * MeiGen API key makes the request countable against that account's own daily search quota
 * instead — which is what lets a single machine keep searching behind a shared NAT.
 */
export async function apiSearchPosts(
  baseUrl: string,
  query: string,
  limit: number,
  offset: number,
  apiToken?: string,
): Promise<ApiSearchOutcome> {
  try {
    const params = new URLSearchParams({
      q: query,
      type: 'posts',
      limit: String(limit),
      offset: String(offset),
      media: 'matched-v1',
    })
    const url = `${baseUrl}/api/search?${params}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      ...(apiToken ? { headers: { Authorization: `Bearer ${apiToken}` } } : {}),
    })
    clearTimeout(timeout)

    if (res.status === 429) {
      // 两种 429 的处置完全不同:账户每日额度(code=DAILY_LIMIT_REACHED)vs 匿名 IP 限流。
      const code = await res.json().then(body => (body && typeof body === 'object' && 'code' in body ? String(body.code) : ''), () => '')
      return { kind: code === 'DAILY_LIMIT_REACHED' ? 'daily-limit' : 'rate-limited' }
    }
    if (!res.ok) return { kind: 'unavailable' }

    const json = await res.json() as ApiSearchResponse
    if (!json.success || !json.data) return { kind: 'unavailable' }

    return { kind: 'ok', results: json.data }
  } catch {
    return { kind: 'unavailable' }
  }
}
