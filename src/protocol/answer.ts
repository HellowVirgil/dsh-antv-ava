import type { AnswerDocument, ResultSnapshot, ValueRef, Scalar, ViewSpec } from './types.ts'
import { invariant, record, safeJson, string, MAX_COLUMNS, MAX_RESULT_ROWS } from './guards.ts'
import { CHART_TYPES } from './chart.ts'

export function validateResult(value: unknown): ResultSnapshot {
  safeJson(value)
  invariant(record(value), 'Invalid result')
  for (const key of ['id', 'datasetId', 'datasetVersion', 'queryId', 'executionRef', 'executedAt']) string(value[key], key)
  invariant(Number.isFinite(Date.parse(value.executedAt as string)), 'Invalid execution time')
  if (value.semanticVersion !== undefined) string(value.semanticVersion, 'semantic version')
  invariant(Array.isArray(value.columns) && value.columns.length <= MAX_COLUMNS, 'Invalid columns')
  const ids = new Set<string>()
  for (const column of value.columns) {
    invariant(record(column), 'Invalid column')
    string(column.id, 'column id', 100)
    invariant(!ids.has(column.id), 'Duplicate column')
    ids.add(column.id)
    invariant(['number', 'string', 'boolean', 'date', 'unknown'].includes(String(column.logicalType)), 'Invalid column type')
    if (column.unit !== undefined) string(column.unit, 'unit', 40)
    if (column.encoding !== undefined) invariant(['decimal-string','integer-string','iso-date'].includes(String(column.encoding)), 'Invalid encoding')
  }
  invariant(Array.isArray(value.rows) && value.rows.length <= MAX_RESULT_ROWS, 'Result exceeds row budget')
  for (const row of value.rows) {
    invariant(record(row) && Object.keys(row).every(key => ids.has(key)), 'Invalid result row')
    invariant(Object.values(row).every(cell => cell === null || ['string','number','boolean'].includes(typeof cell)), 'Results must contain scalar values')
    invariant(Object.values(row).every(cell => typeof cell !== 'number' || !Number.isInteger(cell) || Number.isSafeInteger(cell)), 'Unsafe integers must be encoded as strings')
    invariant([...ids].every(id => Object.hasOwn(row, id)), 'Result row is missing a column')
  }
  invariant(Array.isArray(value.rowKeys) && value.rowKeys.length === value.rows.length, 'Invalid row keys')
  value.rowKeys.forEach(key => string(key, 'row key', 100))
  invariant(new Set(value.rowKeys).size === value.rowKeys.length, 'Duplicate row key')
  invariant(value.returnedRows === value.rows.length && typeof value.truncated === 'boolean', 'Invalid result bounds')
  if (value.totalRows !== undefined) invariant(Number.isSafeInteger(value.totalRows) && (value.totalRows as number) >= value.rows.length, 'Invalid total rows')
  if (value.truncatedBy !== undefined) invariant(Array.isArray(value.truncatedBy) && value.truncatedBy.every(item => item === 'rows' || item === 'bytes') && value.truncated, 'Invalid truncation metadata')
  invariant(record(value.evidence), 'Missing result evidence')
  string(value.evidence.source, 'source')
  string(value.evidence.query, 'query', 40_000)
  if (value.evidence.scope !== undefined) string(value.evidence.scope, 'scope')
  if (value.evidence.semantics !== undefined) string(value.evidence.semantics, 'semantics', 12_000)
  return structuredClone(value) as unknown as ResultSnapshot
}
export function resolveValue(ref: ValueRef, results: readonly ResultSnapshot[]): Scalar {
  invariant(record(ref), 'Invalid value reference')
  const result = results.find(item => item.id === ref.resultId)
  invariant(result !== undefined && result.columns.some(col => col.id === ref.columnId), 'Unknown value reference')
  const index = result.rowKeys.indexOf(ref.rowKey)
  invariant(index >= 0, 'Unknown row reference')
  const value = result.rows[index]?.[ref.columnId]
  invariant(value !== undefined, 'Missing referenced value')
  return value
}
export function validateView(value: unknown, results: readonly ResultSnapshot[]): ViewSpec {
  invariant(record(value), 'Invalid view')
  string(value.id, 'view id', 100)
  string(value.resultId, 'result id')
  invariant(CHART_TYPES.includes(value.chartType as never), 'Unsupported view type')
  const result = results.find(item => item.id === value.resultId)
  invariant(result, 'View references an unknown result')
  invariant(record(value.bindings) && Object.values(value.bindings).every(id => typeof id === 'string' && result.columns.some(c => c.id === id)), 'Invalid field bindings')
  for (const key of ['title','axisXTitle','axisYTitle']) if (value[key] !== undefined) string(value[key], key, 500)
  return structuredClone(value) as unknown as ViewSpec
}
function formatSpec(format: unknown, currency: unknown): void {
  if (format !== undefined) invariant(['number','money','percent'].includes(String(format)), 'Invalid value format')
  if (currency !== undefined) invariant(typeof currency === 'string' && /^[A-Z]{3}$/.test(currency), 'Invalid currency')
}
export function validateAnswer(value: unknown): AnswerDocument {
  safeJson(value)
  invariant(record(value) && value.schemaVersion === 1, 'Unsupported answer schema version')
  string(value.id, 'document id', 100)
  invariant(Number.isSafeInteger(value.revision) && (value.revision as number) >= 0, 'Invalid revision')
  invariant(value.source === 'inline' || value.source === 'analysis', 'Invalid answer source')
  invariant(value.language === 'zh-CN' || value.language === 'en-US', 'Invalid language')
  if (value.title !== undefined) string(value.title, 'title', 500)
  invariant(Array.isArray(value.results) && value.results.length <= 8, 'Invalid results')
  const results = value.results.map(validateResult)
  invariant(new Set(results.map(r => r.id)).size === results.length, 'Duplicate result id')
  invariant(Array.isArray(value.views) && value.views.length <= 12, 'Invalid views')
  const views = value.views.map(view => validateView(view, results))
  invariant(new Set(views.map(v => v.id)).size === views.length, 'Duplicate view id')
  invariant(Array.isArray(value.blocks) && value.blocks.length <= 120, 'Invalid blocks')
  const ids = new Set<string>()
  let phraseCount = 0
  for (const block of value.blocks) {
    invariant(record(block), 'Invalid block')
    string(block.id, 'block id', 100)
    invariant(!ids.has(block.id), 'Duplicate block id'); ids.add(block.id)
    if (block.kind === 'paragraph') {
      invariant(Array.isArray(block.phrases), 'Invalid phrases')
      phraseCount += block.phrases.length
      invariant(phraseCount <= 1000, 'Too many phrases')
      for (const phrase of block.phrases) {
        invariant(record(phrase), 'Invalid phrase')
        if (phrase.kind === 'text') { string(phrase.text, 'text'); continue }
        invariant(phrase.kind === 'value', 'Unsupported phrase')
        resolveValue(phrase.ref as ValueRef, results); formatSpec(phrase.format, phrase.currency)
      }
    } else if (block.kind === 'metric') {
      string(block.label, 'metric label', 100)
      resolveValue(block.value as ValueRef, results); formatSpec(block.format, block.currency)
    } else {
      invariant(block.kind === 'chart' && views.some(v => v.id === block.viewId), 'Unknown chart reference')
    }
  }
  return { ...(structuredClone(value) as unknown as AnswerDocument), results, views }
}
export function formatValue(value: Scalar, format: 'number' | 'money' | 'percent' = 'number', language = 'zh-CN', currency?: string): string {
  if (value === null) return '—'
  if (typeof value !== 'number') return String(value) // preserve decimal/bigint strings
  if (format === 'money' && currency === undefined) return new Intl.NumberFormat(language, { maximumFractionDigits: 6 }).format(value)
  return new Intl.NumberFormat(language, {
    style: format === 'percent' ? 'percent' : format === 'money' ? 'currency' : 'decimal',
    ...(currency === undefined ? {} : { currency }),
    maximumFractionDigits: format === 'percent' ? 2 : 6,
  }).format(value)
}
