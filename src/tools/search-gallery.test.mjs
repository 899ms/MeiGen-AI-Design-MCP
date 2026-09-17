import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import galleryModule from './search-gallery.js'
const { registerSearchGallery, searchGallerySchema } = galleryModule

/** Register the tool and hand back both the schema-validating entry and the raw handler. */
function searchTool(config) {
  let handler
  let description
  registerSearchGallery({ tool: (...args) => { description = args[1]; handler = args.at(-1) } }, config)
  const schema = z.object(searchGallerySchema)
  return { description, handler, run: args => handler(schema.parse(args)) }
}

test('semantic search negotiates matched media and renders the returned image index', async () => {
  let handler
  registerSearchGallery({ tool: (...args) => { handler = args.at(-1) } }, { meigenBaseUrl: 'https://test.invalid' })
  const previous = globalThis.fetch
  globalThis.fetch = async input => {
    const url = new URL(input)
    assert.equal(url.searchParams.get('media'), 'matched-v1')
    assert.equal(url.searchParams.get('offset'), '40')
    return Response.json({ success: true, data: [{ id: 'hit', text: 'poster', likes: 2, views: 10,
      thumbnail_url: 'first-thumb.jpg', media_urls: ['first.jpg','second.jpg'], matched_media_index: 1 }] })
  }
  try {
    const result = await handler({ query: 'poster', limit: 3, offset: 40 })
    assert.match(result.content[0].text, /second\.jpg/)
    assert.doesNotMatch(result.content[0].text, /first-thumb\.jpg/)
  } finally { globalThis.fetch = previous }
})

test('a limit written against the old maximum is clamped, not rejected by the schema', async () => {
  const { run, description } = searchTool({ meigenBaseUrl: 'https://test.invalid' })
  const previous = globalThis.fetch
  const requested = []
  globalThis.fetch = async input => {
    requested.push(new URL(input).searchParams.get('limit'))
    return Response.json({ success: true, data: Array.from({ length: 3 }, (_, index) => ({
      id: `hit-${index}`, text: 'poster', likes: 0, views: 0, thumbnail_url: `t-${index}.jpg`, media_urls: null })) })
  }
  try {
    // 旧自动化传 5 / 10:schema 必须接受,否则调用方在工具运行前就拿到无法恢复的 schema error。
    const result = await run({ query: 'poster', limit: 10 })
    assert.deepEqual(requested, ['3'])
    assert.match(result.content[0].text, /Found 3 results/)
    assert.deepEqual(z.object(searchGallerySchema).parse({ limit: 5 }).limit, 5)
    assert.throws(() => z.object(searchGallerySchema).parse({ limit: 21 }))
    assert.match(description, /at most 3/)
    assert.match(description, /daily search quota/)
  } finally { globalThis.fetch = previous }
})

test('an oversized limit also clamps the bundled local library path', async () => {
  const { run } = searchTool({ meigenBaseUrl: 'https://test.invalid' })
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('the local library path must not call the API') }
  try {
    const random = await run({ limit: 10 })
    assert.match(random.content[0].text, /Here are 3 random picks/)
    const filtered = await run({ query: 'portrait', category: 'Photography', limit: 10 })
    assert.equal((filtered.content[0].text.match(/^\s*\d+\. \*\*#/gm) ?? []).length <= 3, true)
  } finally { globalThis.fetch = previous }
})

test('a configured MeiGen key authenticates the search so the quota lands on the account', async () => {
  const previous = globalThis.fetch
  const seen = []
  globalThis.fetch = async (input, init) => {
    seen.push(new Headers(init?.headers).get('Authorization'))
    return Response.json({ success: true, data: [{ id: 'hit', text: 'poster', likes: 1, views: 1, thumbnail_url: 'a.jpg', media_urls: null }] })
  }
  try {
    await searchTool({ meigenBaseUrl: 'https://test.invalid', meigenApiToken: 'meigen_sk_test_not_a_real_credential' }).run({ query: 'poster' })
    await searchTool({ meigenBaseUrl: 'https://test.invalid' }).run({ query: 'poster' })
    assert.deepEqual(seen, ['Bearer meigen_sk_test_not_a_real_credential', null])
  } finally { globalThis.fetch = previous }
})

test('an account daily-limit 429 says when it resets and still answers from the bundled library', async () => {
  const { run } = searchTool({ meigenBaseUrl: 'https://test.invalid', meigenApiToken: 'meigen_sk_test' })
  const previous = globalThis.fetch
  globalThis.fetch = async () => Response.json({ success: false, error: 'Daily search limit reached', code: 'DAILY_LIMIT_REACHED' }, { status: 429 })
  try {
    const result = await run({ query: 'portrait', limit: 3 })
    assert.match(result.content[0].text, /resets at 00:00 UTC/)
    assert.doesNotMatch(result.content[0].text, /retry in about a minute/)
    // 打包库仍然给结果,而不是把用户晾一天
    assert.match(result.content[0].text, /Found \d+ results/)
  } finally { globalThis.fetch = previous }
})

test('an anonymous per-IP 429 keeps the one-minute wording and no bundled fallback', async () => {
  const { run } = searchTool({ meigenBaseUrl: 'https://test.invalid' })
  const previous = globalThis.fetch
  globalThis.fetch = async () => Response.json({ success: false, error: 'Too many requests' }, { status: 429 })
  try {
    const result = await run({ query: 'portrait', limit: 3 })
    assert.match(result.content[0].text, /retry in about a minute/)
    assert.doesNotMatch(result.content[0].text, /Found \d+ results/)
  } finally { globalThis.fetch = previous }
})
