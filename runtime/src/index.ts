import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { CHART_TYPES, invariant, keys, record, string, type AnswerBlock, type ChartType } from 'dsh-antv-ava/protocol'
import { AnalysisRuntime, type RuntimeOptions } from './service.js'
import { openSessionSource } from './source.js'

export { AnalysisRuntime } from './service.js'
export const inject = ['tools', 'systemPrompt']
const text = { type: 'string' }
const valueRef = {
  type: 'object', additionalProperties: false,
  properties: { resultId: text, rowKey: text, columnId: text },
  required: ['resultId','rowKey','columnId'],
}
const valueFormat = { type: 'string', enum: ['number','money','percent'] }
const phrase = { oneOf: [
  { type: 'object', additionalProperties: false, properties: { kind: { const: 'text' }, text }, required: ['kind','text'] },
  { type: 'object', additionalProperties: false, properties: { kind: { const: 'value' }, ref: valueRef, format: valueFormat, currency: text }, required: ['kind','ref','format'] },
] }
const answerBlock = { oneOf: [
  { type: 'object', additionalProperties: false, properties: { id: text, kind: { const: 'paragraph' }, phrases: { type: 'array', items: phrase } }, required: ['id','kind','phrases'] },
  { type: 'object', additionalProperties: false, properties: { id: text, kind: { const: 'metric' }, label: text, value: valueRef, format: valueFormat, currency: text }, required: ['id','kind','label','value'] },
  { type: 'object', additionalProperties: false, properties: { id: text, kind: { const: 'chart' }, viewId: { type: 'string', const: 'chart' } }, required: ['id','kind','viewId'] },
] }
function owner(exec: ToolRunContext): string {
  invariant(exec.agent?.id, 'AVA tools require a DSH agent session')
  return String(exec.agent.id)
}
function argument(args: Record<string, unknown>, key: string): string { string(args[key], key, 40_000); return args[key] }
export function definitions(runtime: AnalysisRuntime, host?: Context): ToolDefinition[] {
  const make = (name: string, description: string, properties: Record<string, unknown>, required: string[], run: (args: Record<string, unknown>, exec: ToolRunContext) => Promise<unknown>): ToolDefinition => ({
    name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
    output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async (args, exec) => { invariant(record(args), 'Arguments must be an object'); keys(args, Object.keys(properties)); owner(exec); exec.signal.throwIfAborted(); return run(args, exec) },
  })
  return [
    make('ava_dataset_open', 'Open CSV, JSON or XLSX from the current conversation or its workspace. Supply exactly one of path or attachmentId. Use uploaded files directly: their provided host path, unique filename, or attachmentId is accepted. Relative file paths resolve against this session workspace; ./filename explicitly selects a workspace file. Do not copy uploads or probe unrelated directories. Inspect the returned schema before querying.', { path: text, attachmentId: { type: 'string', description: 'The sha256:... attachmentId of a file uploaded in this conversation; omit path when using this.' } }, [], (a,e) => openSessionSource(runtime,a,e,host)),
    make('ava_dataset_inspect', 'Read schema and business definitions; optionally compute a statistical profile.', { datasetId: text, profile: { type: 'boolean' } }, ['datasetId'], (a,e) => { invariant(a.profile === undefined || typeof a.profile === 'boolean', 'Invalid profile flag'); return runtime.inspect(owner(e), argument(a,'datasetId'), a.profile === true, e.signal) }),
    make('ava_dataset_semantics', 'Set user-supported AVA business definitions. They guide interpretation and do not rewrite SQL or enforce access policy.', { datasetId: text, semantic: { type: 'object', additionalProperties: true } }, ['datasetId','semantic'], (a,e) => runtime.semantics(owner(e), argument(a,'datasetId'), a.semantic, e.signal)),
    make('ava_query', 'Execute one read-only DuckDB SELECT. The saved result ID is authoritative. Preview rows are bounded; do not infer population totals from truncated results.', { datasetId: text, sql: text, maxRows: { type: 'integer' } }, ['datasetId','sql'], async (a,e) => {
      if (a.maxRows !== undefined) invariant(typeof a.maxRows === 'number', 'Invalid maxRows')
      const r = await runtime.query(owner(e), argument(a,'datasetId'), argument(a,'sql'), a.maxRows === undefined ? {} : { maxRows: a.maxRows as number }, e.signal)
      const preview = r.rows.slice(0,20)
      return { resultId: r.id, columns: r.columns, rows: preview, rowKeys: r.rowKeys.slice(0,20), returnedRows: r.returnedRows, truncated: r.truncated, previewTruncated: preview.length < r.rows.length }
    }),
    make('ava_result_present', 'Create a chart/table from a saved result without changing values. Use renderer-field to source-column bindings. Emit the returned ava fence unchanged. Optional blocks reference saved values; the chart viewId is chart.', {
      resultId: text, chartType: { type: 'string', enum: CHART_TYPES }, bindings: { type: 'object', additionalProperties: true }, title: text, axisXTitle: text, axisYTitle: text, language: { type: 'string', enum: ['zh-CN','en-US'] }, blocks: { type: 'array', items: answerBlock, description: 'Optional ordered narrative/metric/chart blocks. Numeric values reference this resultId and a rowKey and columnId from ava_query. Percent formats a fractional value (0.25 → 25%); money uses an ISO currency. Include viewId chart to show the chart.' },
    }, ['resultId','chartType','bindings'], async (a,e) => {
      invariant(CHART_TYPES.includes(a.chartType as ChartType) && record(a.bindings), 'Invalid chart specification')
      for (const value of Object.values(a.bindings)) string(value, 'binding')
      for (const key of ['title','axisXTitle','axisYTitle']) if (a[key] !== undefined) string(a[key], key, 500)
      invariant(a.language === undefined || a.language === 'zh-CN' || a.language === 'en-US', 'Invalid language')
      return runtime.present(owner(e), {
        resultId: argument(a,'resultId'), view: { chartType: a.chartType as ChartType, bindings: a.bindings as Record<string,string>, ...(a.title ? { title: a.title as string } : {}), ...(a.axisXTitle ? { axisXTitle: a.axisXTitle as string } : {}), ...(a.axisYTitle ? { axisYTitle: a.axisYTitle as string } : {}) },
        ...(a.title ? { title: a.title as string } : {}), ...(a.language ? { language: a.language as 'zh-CN' | 'en-US' } : {}), ...(a.blocks === undefined ? {} : { blocks: a.blocks as AnswerBlock[] }),
      }, e.signal)
    }),
    make('ava_dataset_close', 'Release a dataset and its process. Saved result presentations remain readable.', { datasetId: text }, ['datasetId'], async (a,e) => { await runtime.close(owner(e), argument(a,'datasetId')); return { closed: true } }),
  ]
}

export function resultHandler(runtime: AnalysisRuntime): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req,res) => {
    const id = new URL(req.url ?? '/', 'http://dsh.local').pathname.match(/^\/plugins\/dsh-antv-ava\/results\/([a-f0-9]{64})$/)?.[1]
    if (!id || !['GET','HEAD'].includes(req.method ?? '') || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(404); res.end(); return }
    try {
      const document = await runtime.presentation(id)
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control':'private, no-store', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer', 'cross-origin-resource-policy':'same-origin' })
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(document))
    } catch { res.writeHead(404, { 'cache-control':'no-store' }); res.end() }
  }
}

export function apply(ctx: Context, config: Partial<RuntimeOptions> = {}): void {
  const runtime = new AnalysisRuntime({ roots: config.roots ?? [process.cwd()], storageDir: resolve(config.storageDir ?? join(homedir(), '.local/share/dsh-antv-ava')), ...(config.idleMs === undefined ? {} : { idleMs: config.idleMs }) })
  for (const tool of definitions(runtime, ctx)) ctx.tools.register(tool)
  ctx.systemPrompt.section({ name:'antv-ava:analysis', order:108, text: 'AVA data tools are available. Use ava_dataset_open → ava_dataset_inspect → ava_query for authorized CSV/JSON/XLSX analysis. Open uploaded files directly using their provided attachment path, unique filename or attachmentId; never copy uploads to guess an allowed directory. Relative paths resolve against the current session workspace. Read actual field names and business definitions, compute derived facts in SQL, and respect result truncation. Use ava_result_present to bind chart fields to saved result columns, then emit its returned ava result fence exactly. Never invent result IDs or claim supplied data was executed. Close datasets when finished; saved presentations survive closure. For supplied small datasets, the existing inline ava fence remains available. Never infer causes from correlation.' })
  let registered = false
  const register = (): void => {
    if (registered) return
    const server = ctx.reflect.get('webServer', false) as { register(route: unknown): unknown } | undefined
    if (!server) return
    const remove = server.register({ kind:'prefix', path:'/plugins/dsh-antv-ava/results', handler:resultHandler(runtime) })
    if (typeof remove === 'function') ctx.effect(() => () => { remove() })
    registered = true
  }
  register()
  ctx.on('internal/service', (name: string) => { if (name === 'webServer') register() })
  ctx.on('agent/disposed', async ({ agent }) => { await runtime.closeOwner(String(agent.id)) })
  const timer = setInterval(() => { void runtime.expire().catch(() => {}) }, 60_000)
  timer.unref()
  ctx.effect(() => async () => { clearInterval(timer); await runtime.dispose() })
}
