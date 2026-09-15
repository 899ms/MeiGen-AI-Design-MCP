import assert from 'node:assert/strict'
import test from 'node:test'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function fixture(t, gitStatus = ' M package.json\n', supportsStage = true) {
  const root = mkdtempSync(join(tmpdir(), 'meigen-release-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'bin'))
  copyFileSync(new URL('../release.mjs', import.meta.url), join(root, 'scripts/release.mjs'))
  writeFileSync(join(root, '.env.local'), 'RELEASE_PRIVATE_FILE_LOADED=yes\n')
  const log = join(root, 'commands.jsonl')
  for (const command of ['git', 'pnpm', 'npm']) {
    const code = command === 'git'
      ? `process.stdout.write(${JSON.stringify(gitStatus)});`
      : `require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify({ command: ${JSON.stringify(command)}, args: process.argv.slice(2), privateFileLoaded: process.env.RELEASE_PRIVATE_FILE_LOADED }) + '\\n');\nif (process.argv[2] === 'stage' && process.argv[3] === '--help') process.stdout.write(${JSON.stringify(supportsStage ? 'npm stage publish' : 'unknown command')});`
    const path = join(root, 'bin', command)
    writeFileSync(path, `#!${process.execPath}\n${code}\n`)
    chmodSync(path, 0o755)
  }
  const run = mode => spawnSync(process.execPath, [join(root, 'scripts/release.mjs'), mode], {
    cwd: root,
    env: { PATH: join(root, 'bin'), NPM_TOKEN: 'npm_fixture_not_a_real_credential' },
    encoding: 'utf8',
  })
  const calls = () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : []
  return { run, calls }
}

test('dirty-tree dry run never loads the private env file and remains non-publishing', t => {
  const f = fixture(t)
  assert.equal(f.run('dry-run').status, 0)
  assert.equal(f.calls().length, 1)
  const call = f.calls()[0]
  assert.equal(call.command, 'pnpm')
  assert.ok(call.args.includes('--dry-run'))
  assert.ok(call.args.includes('--no-git-checks'))
  assert.equal(call.privateFileLoaded, undefined)
})

test('dirty-tree staging is rejected before any npm process can submit a package', t => {
  const f = fixture(t)
  const result = f.run('stage')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /clean Git working tree/)
  assert.deepEqual(f.calls(), [])
})

test('unsupported staging CLI fails without a fallback to direct publish', t => {
  const f = fixture(t, '', false)
  const result = f.run('stage')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /does not support npm stage publish/)
  assert.deepEqual(f.calls().map(call => call.args), [['stage', '--help']])
})

test('authorized staging command uses staged publication without auto-approval', t => {
  const f = fixture(t, '')
  assert.equal(f.run('stage').status, 0)
  assert.deepEqual(f.calls().map(call => call.args.slice(0, 2)), [['stage', '--help'], ['stage', 'publish']])
  assert.ok(f.calls().every(call => call.command === 'npm'))
})
