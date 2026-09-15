import test from 'node:test'
import assert from 'node:assert/strict'
import guidanceModule from '../lib/generation-shared.js'

const { classifyError } = guidanceModule

test('billing recovery is scoped to the provider that actually failed', () => {
  const meigen = classifyError('HTTP 402: insufficient credits', 'meigen')
  assert.match(meigen, /https:\/\/www.meigen.ai\/profile/)
  assert.doesNotMatch(meigen, /model-comparison/)
  const byok = classifyError('HTTP 402: insufficient credits', 'openai')
  assert.match(byok, /OPENAI_BASE_URL/)
  assert.doesNotMatch(byok, /https:\/\/www.meigen.ai/)
  assert.match(classifyError('insufficient quota', 'comfyui'), /ComfyUI workflow/)
  assert.doesNotMatch(classifyError('insufficient GPU memory', 'comfyui'), /credits|balance|billing/)
})

test('BYOK key failures point to the configured provider', () => {
  const result = classifyError('Invalid API key', 'openai')
  assert.match(result, /OpenAI-compatible provider/)
  assert.doesNotMatch(result, /MEIGEN_API_TOKEN/)
})
