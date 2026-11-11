import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const local = await import('../../scripts/local.mjs').catch(() => null)
const localTest = (name, fn) => test(name, { skip: local === null }, fn)

async function project(run) {
  const root = await mkdtemp(join(tmpdir(), 'baton-local-test-'))
  await mkdir(join(root, 'baton-server'))
  await writeFile(join(root, 'baton-server', 'Cargo.toml'), '[package]\nname="fixture"\n')
  try { await run(root) } finally { await rm(root, { recursive: true, force: true }) }
}

localTest('local setup creates one persistent private secret and usable data/workspace directories', () => project(async root => {
  const { prepareLocal } = local
  const first = await prepareLocal(root)
  const original = await readFile(first.secretFile, 'utf8')
  const second = await prepareLocal(root)
  assert.equal(await readFile(second.secretFile, 'utf8'), original)
  assert.match(original.trim(), /^[0-9a-f]{64}$/)
  assert.equal((await stat(first.secretFile)).mode & 0o777, 0o600)
  assert.equal((await stat(first.dataDir)).mode & 0o777, 0o700)
  assert.equal((await stat(first.workspace)).isDirectory(), true)
  assert.ok(first.pluginConfig.includes(first.secretFile))
  assert.equal(first.pluginConfig.includes(original.trim()), false, 'configuration output must not contain the key')
  assert.equal(first.serverUrl, 'ws://127.0.0.1:8080/ws')
}))

localTest('local setup reuses an existing secret rather than replacing it', () => project(async root => {
  const { prepareLocal } = local
  const key = 'existing-local-test-secret-1234567890'
  await writeFile(join(root, '.baton-secret'), key + '\n', { mode: 0o600 })
  const result = await prepareLocal(root)
  assert.equal(result.secret, key)
  assert.equal(await readFile(result.secretFile, 'utf8'), key + '\n')
}))

localTest('invalid or exposed secrets and environment mismatches fail without replacing the file', () => project(async root => {
  const { prepareLocal } = local
  const path = join(root, '.baton-secret')
  await writeFile(path, 'short\n', { mode: 0o600 })
  await assert.rejects(prepareLocal(root), /32/)
  assert.equal(await readFile(path, 'utf8'), 'short\n')
  await writeFile(path, 'private-test-secret-1234567890123456\n')
  await assert.rejects(prepareLocal(root, { secret: 'different-test-secret-12345678901234' }), /不一致/)
  await rm(path)
  await writeFile(path, 'exposed-test-secret-1234567890123456\n', { mode: 0o644 })
  await assert.rejects(prepareLocal(root), /0600/)
}))

localTest('local setup only accepts loopback bindings and prints the matching plugin URL', () => project(async root => {
  const { prepareLocal } = local
  await assert.rejects(prepareLocal(root, { bind: '0.0.0.0:8080' }), /回环/)
  const config = await prepareLocal(root, { bind: '127.0.0.1:19080' })
  assert.equal(config.serverUrl, 'ws://127.0.0.1:19080/ws')
  assert.ok(config.pluginConfig.includes(config.serverUrl))
}))

localTest('local check does not silently initialize missing credentials', () => project(async root => {
  const { loadLocal } = local
  await assert.rejects(loadLocal(root), /先运行/)
  await assert.rejects(stat(join(root, '.baton-secret')), { code: 'ENOENT' })
}))
