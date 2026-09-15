import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = process.argv[2]
if (!webRoot || process.argv.length !== 3) {
  console.error('Usage: node scripts/ci/check-guidance-sync.mjs /path/to/meigen-web')
  process.exit(1)
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const normalize = text => text.replace(/^\/\*\*[^\n]*\*\/\r?\n/, '').replaceAll('\r\n', '\n')
try {
  const local = normalize(readFileSync(resolve(root, 'src/lib/skill-guidance.ts'), 'utf8'))
  const remote = normalize(readFileSync(resolve(webRoot, 'src/lib/skills/mcp-guidance.ts'), 'utf8'))
  if (local !== remote) throw new Error('Guidance differs between npm and the specified Web checkout.')
  const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
  const pins = [...remote.matchAll(/meigen@([^'"\s,\]]+)/g)].map(match => match[1])
  if (!pins.length || pins.some(pin => pin !== version)) throw new Error(`Web guidance must pin meigen@${version}.`)
  console.log('Cross-repository guidance and npm pin match.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Guidance check failed.')
  process.exitCode = 1
}
