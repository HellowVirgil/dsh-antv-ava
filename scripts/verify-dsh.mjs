import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as Plugin from '../runtime/lib/index.js'

// Exercise the installed DSH services in an isolated Context, without touching profiles.
const binary = process.env.AVA_TEST_DSH_BINARY ?? execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim()
const require = createRequire(realpathSync(binary))
const load = name => import(pathToFileURL(require.resolve(name)).href)
const [{ Context }, { default: SystemPrompt }, { default: Tools }] = await Promise.all([
  load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-system-prompt'), load('@deepseek-ai/dsh-tools'),
])
const directory = await mkdtemp(join(tmpdir(), 'ava-dsh-check-'))
const ctx = new Context()
const forks = []
const routes = new Map()
const options = { roots: [directory], storageDir: join(directory, 'store') }
let serial = 0
const agent = { id: 'ava-verification-session', ctx }
const invoke = async (name, args, caller = agent, signal = new AbortController().signal) => {
  const result = await ctx.tools.execute({ callId: 'ava-check-' + ++serial, name, arguments: args, agent: caller, signal })
  assert.equal(result.isError, false, JSON.stringify(result.content))
  return result.value
}
try {
  const file = join(directory, 'sales.csv')
  await writeFile(file, 'product,revenue\nA,4\nA,6\nB,3\n')
  forks.push(await ctx.plugin(SystemPrompt))
  forks.push(await ctx.plugin(Tools))
  let runtime = await ctx.plugin(Plugin, options)
  forks.push(runtime)
  const names = ctx.tools.schemas().map(tool => tool.name)
  assert.equal(names.length, 6)
  assert.ok(names.includes('ava_query'))
  ctx.provide('webServer', { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } })
  const routePath = '/plugins/dsh-antv-ava/results'
  assert.ok(routes.has(routePath), 'late webServer registration')
  const opened = await invoke('ava_dataset_open', { path: file })
  const result = await invoke('ava_query', {
    datasetId: opened.datasetId, sql: 'SELECT product, SUM(revenue) AS revenue FROM data GROUP BY product ORDER BY product',
  })
  assert.deepEqual(result.rows, [{ product: 'A', revenue: 10 }, { product: 'B', revenue: 3 }])
  const denied = await ctx.tools.execute({
    callId: 'ava-cross-session', name: 'ava_dataset_inspect', arguments: { datasetId: opened.datasetId },
    agent: { id: 'another-session', ctx }, signal: new AbortController().signal,
  })
  assert.equal(denied.isError, true)
  const presentation = await invoke('ava_result_present', {
    resultId: result.resultId, chartType: 'bar', bindings: { category: 'product', value: 'revenue' },
    blocks: [
      { id: 'narrative', kind: 'paragraph', phrases: [
        { kind: 'text', text: 'A revenue: ' },
        { kind: 'value', ref: { resultId: result.resultId, rowKey: '0', columnId: 'revenue' }, format: 'number' },
      ] },
      { id: 'chart', kind: 'chart', viewId: 'chart' },
    ],
  })
  assert.match(presentation.fence, /^\x60\x60\x60ava\nava result [a-f0-9]{64}\n\x60\x60\x60$/)
  const fetchSnapshot = async () => {
    let code, headers, body
    await routes.get(routePath).handler(
      { method: 'GET', url: routePath + '/' + presentation.presentationId, headers: { 'sec-fetch-site': 'same-origin' } },
      { writeHead(value, metadata) { code = value; headers = metadata }, end(value) { body = value } },
    )
    assert.equal(code, 200)
    assert.equal(headers['cache-control'], 'private, no-store')
    return JSON.parse(body)
  }
  await invoke('ava_dataset_close', { datasetId: opened.datasetId })
  assert.equal((await fetchSnapshot()).results[0].rows[0].revenue, 10)

  // Unload with an open dataset, then reload and replay the same durable snapshot.
  await invoke('ava_dataset_open', { path: file })
  await runtime.dispose()
  forks.pop()
  assert.deepEqual(ctx.tools.schemas(), [])
  assert.equal(routes.has(routePath), false)
  assert.deepEqual(await readdir(join(directory, 'store', 'sources')), [])
  runtime = await ctx.plugin(Plugin, options)
  forks.push(runtime)
  assert.equal((await fetchSnapshot()).results[0].rows[0].revenue, 10)
  const pending = await invoke('ava_dataset_open', { path: file })
  await ctx.parallel('agent/disposed', { agent })
  const closed = await ctx.tools.execute({
    callId: 'ava-after-disposal', name: 'ava_dataset_inspect', arguments: { datasetId: pending.datasetId },
    agent, signal: new AbortController().signal,
  })
  assert.equal(closed.isError, true)
  assert.deepEqual(await readdir(join(directory, 'store', 'sources')), [])
  console.log('verify-dsh: OK — registration, actual query, ownership, late routes, unload, replay, and agent disposal')
} finally {
  for (const fork of forks.reverse()) await fork.dispose()
  await rm(directory, { recursive: true, force: true })
}
