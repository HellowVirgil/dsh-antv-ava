#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validateRuntimeMetadata({ base, runtime, packed, tag, prerelease }) {
  if (tag !== `v${base.version}`) throw new Error('Release tag must match the base package version')
  if (packed.name !== runtime.name || packed.version !== runtime.version) throw new Error('Runtime archive identity does not match the release source')
  if (packed.private === true) throw new Error('Runtime is still private')
  if (packed.publishConfig?.access !== 'public' || packed.publishConfig?.registry !== 'https://registry.npmjs.org/') throw new Error('Runtime must target the public npm registry')
  if (packed.repository?.url !== base.repository?.url) throw new Error('Runtime repository must match the release repository')
  if (packed.dependencies?.[base.name] !== base.version) throw new Error('Runtime must depend on the exact base release')
  if (Object.values(packed.dependencies ?? {}).some(value => /^(?:workspace:|file:|link:)/.test(value))) throw new Error('Runtime archive contains a local dependency')
  const isPrerelease = runtime.version.includes('-')
  if (isPrerelease !== prerelease || base.version.includes('-') !== prerelease) throw new Error('Both package versions must match the GitHub prerelease state')
  return isPrerelease ? 'next' : 'latest'
}

export function checkRuntimePublish(directory, tag, prerelease) {
  const base = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const runtime = JSON.parse(readFileSync(new URL('../runtime/package.json', import.meta.url), 'utf8'))
  const filename = `${runtime.name}-${runtime.version}.tgz`
  const archive = join(directory, filename)
  const sums = readFileSync(join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n')
  const checksum = sums.map(line => line.trim().split(/\s+/)).find(([, name]) => name === filename)?.[0]
  if (!checksum || createHash('sha256').update(readFileSync(archive)).digest('hex') !== checksum) throw new Error('Runtime archive checksum mismatch')
  const packed = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
  return { archive, npmTag: validateRuntimeMetadata({ base, runtime, packed, tag, prerelease }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!['true', 'false'].includes(process.env.RELEASE_PRERELEASE ?? '')) throw new Error('GitHub prerelease state is required')
  const result = checkRuntimePublish('.release-artifacts', process.env.RELEASE_TAG, process.env.RELEASE_PRERELEASE === 'true')
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `archive=${result.archive}\nnpm_tag=${result.npmTag}\n`)
  console.log(`Runtime npm artifact verified: ${result.archive} (${result.npmTag})`)
}
