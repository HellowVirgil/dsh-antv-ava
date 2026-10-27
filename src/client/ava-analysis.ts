import { getInsights } from '@antv/ava'
// GPT-Vis 1.0 publishes a CommonJS `main` inside a `type: module` package.
// Select the standalone ESM parser so Vite, Node tests, and tsdown agree.
import { parse } from '@antv/gpt-vis/dist/esm/syntax/parser.js'
import type { AvaDocument, AvaField } from './ava-source.ts'

export interface AvaPattern {
  type: string
  [key: string]: unknown
}

export interface AvaAnalysis {
  fields: AvaField[]
  patterns: AvaPattern[]
  status?: 'complete' | 'unsupported'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tabularData(config: Record<string, unknown>): Array<Record<string, string | number>> {
  if (!Array.isArray(config.data)) return []
  return config.data.flatMap(item => {
    if (!isRecord(item)) return []
    const row: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) row[key] = value
    }
    return Object.keys(row).length === 0 ? [] : [row]
  })
}

function inferFields(
  data: Array<Record<string, string | number>>,
  config: Record<string, unknown>,
): AvaField[] {
  const ids = [...new Set(data.flatMap(row => Object.keys(row)))]
  const numeric = ids.filter(id => data.some(row => typeof row[id] === 'number'))
  const categorical = ids.filter(id => !numeric.includes(id))
  const dimensions = categorical.length > 0 ? categorical : ids.slice(0, 1)
  return ids.map(id => {
    const role = dimensions.includes(id) ? 'dimension' : 'measure'
    const axisLabel = role === 'dimension' ? config.axisXTitle : config.axisYTitle
    return {
      id,
      label: typeof axisLabel === 'string' && axisLabel !== '' ? axisLabel : id,
      type: role === 'measure' ? 'quantitative' : 'categorical',
      role,
    }
  })
}

export function analyzeAvaDocument(document: AvaDocument): AvaAnalysis {
  const config = parse(document.syntax)
  const data = tabularData(config)
  const fields = inferFields(data, config)
  const dimensions = fields
    .filter(field => field.role === 'dimension')
    .map(field => ({ fieldName: field.id }))
  const measures = fields
    .filter(field => field.role === 'measure')
    .map(field => ({ fieldName: field.id, method: 'SUM' as const }))

  let patterns: AvaPattern[] = []
  if (data.length >= 3 && dimensions.length > 0 && measures.length > 0) {
    try {
      const result = getInsights(data, {
        dimensions,
        measures,
        limit: 4,
        visualization: false,
        homogeneous: false,
        ignoreSubspace: true,
      })
      patterns = result.insights.flatMap(insight => insight.patterns).slice(0, 4) as unknown as AvaPattern[]
    } catch (reason) {
      throw new Error('统计分析失败，请重试。', { cause: reason })
    }
  }

  return { fields, patterns, status: data.length >= 3 && dimensions.length > 0 && measures.length > 0 ? 'complete' : 'unsupported' }
}
