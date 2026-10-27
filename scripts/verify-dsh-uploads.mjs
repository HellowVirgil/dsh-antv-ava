import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as Plugin from '../runtime/lib/index.js'

const binary = process.env.AVA_TEST_DSH_BINARY ?? execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim()
const require = createRequire(realpathSync(binary))
const load = name => import(pathToFileURL(require.resolve(name)).href)
const [
  { Context }, { default: SystemPrompt }, { default: Tools },
  { default: Sessions, SessionId }, { default: Attachments },
  { default: SessionQuery }, { createUserMessage },
] = await Promise.all([
  load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-system-prompt'), load('@deepseek-ai/dsh-tools'),
  load('@deepseek-ai/dsh-session'), load('@deepseek-ai/dsh-attachment-local'),
  load('@deepseek-ai/dsh-session-query-sqlite'), load('@deepseek-ai/dsh-llm'),
])
assert.equal(typeof Attachments.prototype.readFileStream, 'function', 'This check requires DSH file attachments (tested on 0.2.1-rc.2)')
const directory = await mkdtemp(join(tmpdir(), 'ava-dsh-upload-check-'))
const ctx = new Context(), forks = []
let serial = 0
try {
  const launch = join(directory, 'launch'), workspace = join(directory, 'workspace'), storageDir = join(directory, 'runtime')
  await mkdir(launch); await mkdir(workspace)
  forks.push(await ctx.plugin(SystemPrompt), await ctx.plugin(Tools), await ctx.plugin(Sessions))
  forks.push(await ctx.plugin(Attachments, { dshHome: join(directory, 'dsh-home') }))
  forks.push(await ctx.plugin(SessionQuery, { path: ':memory:', openAt: 'never' }))
  forks.push(await ctx.plugin(Plugin, { roots: [launch], storageDir }))
  const file = await ctx.attachments.saveFile({ name: 'sales.xlsx', data: await readFile(new URL('../tests/fixtures/sales.xlsx', import.meta.url)) })
  const session = ctx.sessions.create(SessionId('ava-upload-owner'), { meta: { cwd: workspace } })
  session.append('user/message', createUserMessage({
    source: { kind: 'user' },
    content: [{ type: 'file', attachment: file }, { type: 'text', text: 'Analyze the uploaded sales workbook.' }],
  }), { surfaceOp: 'append' })
  const agent = { id: session.id, session, ctx }
  const invoke = async (name, args, caller = agent) => ctx.tools.execute({
    callId: 'ava-upload-' + ++serial, name, arguments: args, agent: caller, signal: new AbortController().signal,
  })
  const success = async (name, args) => {
    const result = await invoke(name, args)
    assert.equal(result.isError, false, JSON.stringify(result.content))
    return result.value
  }
  for (const input of [
    { path: ctx.attachments.fileHostPath(file) }, { attachmentId: file.attachmentId }, { path: 'sales.xlsx' },
  ]) {
    const opened = await success('ava_dataset_open', input)
    const result = await success('ava_query', { datasetId: opened.datasetId, sql: 'SELECT product, SUM(revenue) AS revenue FROM Sales GROUP BY product ORDER BY product' })
    assert.deepEqual(result.rows, [{ product: 'A', revenue: 12 }, { product: 'B', revenue: 8 }])
    await success('ava_dataset_close', { datasetId: opened.datasetId })
  }
  assert.deepEqual(await readdir(workspace), [], 'Opening uploads must not copy files into the workspace')
  await writeFile(join(workspace, 'local.csv'), 'amount\n17\n')
  const local = await success('ava_dataset_open', { path: './local.csv' })
  assert.deepEqual((await success('ava_query', { datasetId: local.datasetId, sql: 'SELECT amount FROM data' })).rows, [{ amount: 17 }])
  const foreign = ctx.sessions.create(SessionId('ava-upload-other'), { meta: { cwd: workspace } })
  for (const input of [{ path: ctx.attachments.fileHostPath(file) }, { attachmentId: file.attachmentId }]) {
    const denied = await invoke('ava_dataset_open', input, { id: foreign.id, session: foreign, ctx })
    assert.equal(denied.isError, true, 'An unrelated session must not inherit the attachment grant')
  }
  const presentationResult = await success('ava_query', { datasetId: local.datasetId, sql: 'SELECT amount FROM data' })
  await success('ava_result_present', { resultId: presentationResult.resultId, chartType: 'table', bindings: {} })
  console.log('verify-dsh-uploads: OK — real attachment storage, history observation, XLSX queries, relative workspace paths, and foreign-session denial')
} finally {
  for (const fork of forks.reverse()) await fork.dispose()
  await rm(directory, { recursive: true, force: true })
}
