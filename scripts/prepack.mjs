#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(command, ['run', 'build'], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
if (result.stdout?.length) process.stderr.write(result.stdout)
if (result.stderr?.length) process.stderr.write(result.stderr)
if (result.error !== undefined) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
