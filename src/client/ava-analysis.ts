import { Advisor, getInsights } from '@antv/ava'
import type { AvaDocument } from './ava-source.ts'

export interface AvaPattern {
  type: string
  [key: string]: unknown
}

export interface AvaAnalysis {
  advice: {
    type: string
    score: number
    spec: Record<string, unknown>
  }
  patterns: AvaPattern[]
}

const advisor = new Advisor()

export function analyzeAvaDocument(document: AvaDocument): AvaAnalysis {
  const advices = advisor.advise({
    data: document.data,
    fields: document.fields.map(field => field.id),
    options: {
      ...(document.purpose === undefined ? {} : { purpose: document.purpose }),
      requireSpec: true,
      refine: true,
    },
  })
  const advice = advices.find(item => item.spec !== null)
  if (advice?.spec === null || advice?.spec === undefined) {
    throw new Error('AVA 没有为当前数据找到可渲染的推荐图表')
  }

  const dimensions = document.fields
    .filter(field => field.role === 'dimension')
    .map(field => ({ fieldName: field.id }))
  const measures = document.fields
    .filter(field => field.role === 'measure')
    .map(field => ({ fieldName: field.id, method: 'SUM' as const }))
  let patterns: AvaPattern[] = []
  if (document.data.length >= 3) {
    try {
      const result = getInsights(document.data, {
        dimensions,
        measures,
        limit: 4,
        visualization: false,
        homogeneous: false,
        ignoreSubspace: true,
      })
      patterns = result.insights.flatMap(insight => insight.patterns).slice(0, 4) as unknown as AvaPattern[]
    } catch (reason) {
      console.warn('[dsh-antv-ava] insight extraction skipped:', reason)
    }
  }

  return {
    advice: {
      type: advice.type,
      score: advice.score,
      spec: advice.spec as Record<string, unknown>,
    },
    patterns,
  }
}
