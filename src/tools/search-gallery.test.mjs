import assert from 'node:assert/strict'
import { test } from 'node:test'
import galleryModule from './search-gallery.js'
const { registerSearchGallery } = galleryModule

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
    const result = await handler({ query: 'poster', limit: 5, offset: 40 })
    assert.match(result.content[0].text, /second\.jpg/)
    assert.doesNotMatch(result.content[0].text, /first-thumb\.jpg/)
  } finally { globalThis.fetch = previous }
})
