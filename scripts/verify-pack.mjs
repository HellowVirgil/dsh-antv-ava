#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const required = [
  'package.json',
  'LICENSE',
  'README.md',
  'README.zh-CN.md',
  'SKILL.md',
  'CHANGELOG.md',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/client.js',
  'lib/assets/ava.js',
  'lib/types/plugin/index.d.ts',
  'lib/types/client/index.d.ts',
  'src/index.ts',
  'tsconfig.json',
  'tsdown.config.ts',
]

const directory = mkdtempSync(join(tmpdir(), 'dsh-antv-ava-pack-'))
try {
  const output = execFileSync('npm', ['pack', '--pack-destination', directory, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const [packed] = JSON.parse(output)
  const files = new Set(packed.files.map(file => file.path))
  const missing = required.filter(file => !files.has(file))
  if (missing.length > 0) throw new Error(`missing package files: ${missing.join(', ')}`)

  const forbidden = [...files].filter(file => file.endsWith('.map') || file.includes('.tsbuildinfo'))
  if (forbidden.length > 0) throw new Error(`forbidden package files: ${forbidden.join(', ')}`)

  const tarballSize = statSync(join(directory, packed.filename)).size
  const maxTarball = 4 * 1024 * 1024
  const maxUnpacked = 12 * 1024 * 1024
  if (tarballSize > maxTarball) throw new Error(`tarball too large: ${tarballSize}`)
  if (packed.unpackedSize > maxUnpacked) throw new Error(`unpacked package too large: ${packed.unpackedSize}`)

  console.log(`verify-pack: OK — ${pkg.name}@${pkg.version}, ${(tarballSize / 1048576).toFixed(2)} MB tarball`)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
