import type { ChartType, ResultSnapshot, ViewSpec } from './types.ts'
import { invariant, keys, record, safeJson, MAX_RESULT_ROWS } from './guards.ts'

export const CHART_TYPES: readonly ChartType[] = ['line', 'bar', 'column', 'pie', 'scatter', 'histogram', 'waterfall', 'table']
const TEXT_KEYS = ['title', 'axisXTitle', 'axisYTitle'] as const
const FIELDS: Record<Exclude<ChartType, 'table'>, string[]> = {
  line: ['time', 'value', 'group'], bar: ['category', 'value', 'group'],
  column: ['category', 'value', 'group'], pie: ['category', 'value'],
  scatter: ['x', 'y', 'group'], histogram: ['value'], waterfall: ['category', 'value'],
}
export function validateChartConfig(input: unknown): Record<string, unknown> {
  safeJson(input)
  const inspectText = (v: unknown): void => {
    if (typeof v === 'string') invariant(!/<\/?[a-z][^>]*>|\b(?:javascript|data|file|https?)\s*:/i.test(v), 'Executable markup and resource URLs are not accepted in chart configuration')
    else if (Array.isArray(v)) v.forEach(inspectText)
    else if (record(v)) Object.values(v).forEach(inspectText)
  }
  inspectText(input)
  invariant(record(input), 'Chart config must be an object')
  invariant(CHART_TYPES.includes(input.type as ChartType), 'Unsupported chart type (summary uses a separate text protocol)')
  const type = input.type as ChartType
  keys(input, ['type', 'data', ...TEXT_KEYS])
  for (const name of TEXT_KEYS) {
    if (input[name] !== undefined) invariant(typeof input[name] === 'string' && input[name].length <= 500, 'Invalid chart label')
  }
  invariant(Array.isArray(input.data) && input.data.length > 0 && input.data.length <= MAX_RESULT_ROWS, 'Chart requires 1–500 data items')
  for (const row of input.data) {
    if (type === 'histogram') { invariant(typeof row === 'number' && Number.isFinite(row), 'Histogram requires finite numbers'); continue }
    invariant(record(row), 'Chart row must be an object')
    if (type === 'table') {
      invariant(Object.keys(row).length <= 32 && Object.values(row).every(v => v === null || ['string', 'boolean', 'number'].includes(typeof v)), 'Invalid table row')
      continue
    }
    keys(row, FIELDS[type])
    const numeric = type === 'scatter' ? ['x', 'y'] : ['value']
    for (const key of numeric) invariant(typeof row[key] === 'number' && Number.isFinite(row[key]), `Invalid numeric field: ${key}`)
    if (type !== 'scatter') invariant(typeof row[type === 'line' ? 'time' : 'category'] === 'string', 'Invalid category/time')
    if (row.group !== undefined) invariant(typeof row.group === 'string', 'Invalid series')
    if (type === 'pie') invariant((row.value as number) >= 0, 'Pie requires non-negative values')
  }
  if (type === 'pie') invariant(input.data.some(row => (row as Record<string, number>).value! > 0), 'Pie total must be positive')
  return structuredClone(input)
}
export function configFromView(view: ViewSpec, result: ResultSnapshot): Record<string, unknown> {
  invariant(result.id === view.resultId, 'View/result mismatch')
  invariant(CHART_TYPES.includes(view.chartType), 'Unsupported chart type')
  const columns = new Map(result.columns.map(c => [c.id, c]))
  const allowed = view.chartType === 'table' ? result.columns.map(c => c.id) : FIELDS[view.chartType]
  invariant(Object.keys(view.bindings).every(k => allowed.includes(k)), 'Unknown chart binding')
  for (const id of Object.values(view.bindings)) invariant(columns.has(id), 'Binding references an unknown column')
  if (view.chartType === 'pie') invariant(!result.truncated, 'A pie chart cannot represent a truncated result')
  const mapped = result.rows.map(row => {
    if (view.chartType === 'table') return { ...row }
    const output: Record<string, unknown> = {}
    for (const [field, id] of Object.entries(view.bindings)) {
      const value = row[id]
      // Precision-bearing strings remain strings; never coerce them silently for charts.
      const numeric = ['value', 'x', 'y'].includes(field)
      invariant(!numeric || (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))), 'Chart values require finite, precision-safe numbers; use a table')
      output[field] = numeric ? value : value === null || value === undefined ? '' : String(value)
    }
    return view.chartType === 'histogram' ? output.value : output
  })
  const config: Record<string, unknown> = { type: view.chartType, data: mapped }
  for (const key of TEXT_KEYS) if (view[key] !== undefined) config[key] = view[key]
  return validateChartConfig(config)
}
