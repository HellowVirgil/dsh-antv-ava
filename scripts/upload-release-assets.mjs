#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const tag = process.env.RELEASE_TAG
if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) throw new Error('A verified release tag is required')
const directory = resolve(process.argv[2] ?? '.release-artifacts')
const runtime = JSON.parse(readFileSync(new URL('../runtime/package.json', import.meta.url), 'utf8'))
const release = JSON.parse(execFileSync('gh', ['release', 'view', tag, '--json', 'assets'], { encoding: 'utf8' }))
const existing = new Set(release.assets.map(asset => asset.name))
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
for (const name of [`${runtime.name}-${runtime.version}.tgz`, 'SHA256SUMS']) {
  const file = join(directory, name)
  if (existing.has(name)) {
    const temporary = mkdtempSync(join(tmpdir(), 'ava-release-check-'))
    try {
      execFileSync('gh', ['release', 'download', tag, '--pattern', name, '--dir', temporary], { stdio: 'pipe' })
      if (hash(join(temporary, name)) !== hash(file)) throw new Error(`Refusing to overwrite a different published asset: ${name}`)
      console.log(`release-asset: ${name} already matches`)
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  } else {
    execFileSync('gh', ['release', 'upload', tag, file], { stdio: 'inherit' })
  }
}
