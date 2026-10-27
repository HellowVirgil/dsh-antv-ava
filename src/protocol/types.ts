export type Scalar = string | number | boolean | null
export type Language = 'zh-CN' | 'en-US'
export type ChartType = 'line' | 'bar' | 'column' | 'pie' | 'scatter' | 'histogram' | 'waterfall' | 'table'
export interface ResultColumn {
  id: string
  logicalType: 'number' | 'string' | 'boolean' | 'date' | 'unknown'
  encoding?: 'decimal-string' | 'integer-string' | 'iso-date'
  unit?: string
}
export interface ResultSnapshot {
  id: string
  datasetId: string
  datasetVersion: string
  semanticVersion?: string
  queryId: string
  columns: ResultColumn[]
  rows: Record<string, Scalar>[]
  rowKeys: string[]
  returnedRows: number
  totalRows?: number
  truncated: boolean
  truncatedBy?: ('rows' | 'bytes')[]
  executedAt: string
  executionRef: string
  evidence: { source: string; query: string; scope?: string; semantics?: string }
}
export interface ValueRef { resultId: string; rowKey: string; columnId: string }
export type Phrase = { kind: 'text'; text: string }
  | { kind: 'value'; ref: ValueRef; format: 'number' | 'money' | 'percent'; currency?: string }
export type AnswerBlock =
  | { id: string; kind: 'paragraph'; phrases: Phrase[] }
  | { id: string; kind: 'metric'; label: string; value: ValueRef; format?: 'number' | 'money' | 'percent'; currency?: string }
  | { id: string; kind: 'chart'; viewId: string }
export interface ViewSpec {
  id: string
  resultId: string
  chartType: ChartType
  /** Renderer field → result column, e.g. { category: 'product', value: 'delta' }. */
  bindings: Record<string, string>
  title?: string
  axisXTitle?: string
  axisYTitle?: string
}
export interface AnswerDocument {
  schemaVersion: 1
  id: string
  revision: number
  source: 'inline' | 'analysis'
  language: Language
  title?: string
  results: ResultSnapshot[]
  views: ViewSpec[]
  blocks: AnswerBlock[]
}
export interface JsonChartDocument {
  mode: 'json-chart'
  chartType: ChartType
  config: Record<string, unknown>
  language: Language
}
export interface AnswerReference { mode: 'reference'; id: string }
export interface StructuredAnswer { mode: 'answer'; document: AnswerDocument }
