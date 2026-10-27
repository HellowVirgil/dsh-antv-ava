#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const directory = resolve(process.argv[2] ?? '.release-artifacts')
const base = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const runtime = JSON.parse(readFileSync(new URL('../runtime/package.json', import.meta.url), 'utf8'))
mkdirSync(directory, { recursive: true })
execFileSync('pnpm', ['--dir', 'runtime', 'pack', '--pack-destination', directory], { cwd: root, stdio: 'pipe' })
const archive = resolve(directory, `${runtime.name}-${runtime.version}.tgz`)
const manifest = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
if (manifest.dependencies['dsh-antv-ava'] !== base.version) throw new Error('Runtime must depend on the exact released base version')
if (Object.values(manifest.dependencies).some(value => /^(?:workspace:|link:|file:)/.test(value))) throw new Error('Runtime contains a local dependency reference')
const files = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
for (const name of ['package.json', 'LICENSE', 'README.md', 'cordis.patch.yml', 'lib/index.js', 'lib/index.d.ts', 'lib/service.js', 'lib/source.js', 'lib/channel.js', 'lib/worker.js']) {
  if (!files.includes('package/' + name)) throw new Error(`Runtime package missing ${name}`)
}
for (const name of files.filter(file => /\.(?:js|ts|json|md|ya?ml)$/.test(file))) {
  const contents = execFileSync('tar', ['-xOf', archive, name], { encoding: 'utf8' })
  if (/\/Users\/[^/\s]+\/|\/var\/folders\//.test(contents)) throw new Error(`Host path found in ${name}`)
}
const sha = createHash('sha256').update(readFileSync(archive)).digest('hex')
writeFileSync(resolve(directory, 'SHA256SUMS'), `${sha}  ${basename(archive)}\n`)
console.log(`runtime-pack: OK — ${basename(archive)}, base ${base.version}, sha256 ${sha}`)
