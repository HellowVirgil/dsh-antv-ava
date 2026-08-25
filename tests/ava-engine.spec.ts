import { describe, expect, it } from 'vitest'
import { analyzeAvaDocument } from '../src/client/ava-analysis.ts'
import type { AvaDocument } from '../src/client/ava-source.ts'

describe('AVA engine adapter', () => {
  it('recommends a renderable trend chart for quarterly text data', () => {
    const document: AvaDocument = {
      title: '季度收入趋势',
      purpose: 'Trend',
      language: 'zh-CN',
      fields: [
        { id: 'quarter', label: '季度', type: 'temporal', role: 'dimension' },
        { id: 'revenue', label: '收入（万元）', type: 'quantitative', role: 'measure' },
      ],
      data: [
        { quarter: 'Q1', revenue: 128 },
        { quarter: 'Q2', revenue: 164 },
        { quarter: 'Q3', revenue: 191 },
        { quarter: 'Q4', revenue: 226 },
      ],
    }

    const result = analyzeAvaDocument(document)
    expect(result.advice.type).toBe('line_chart')
    expect(result.advice.spec.type).toBe('line')
    expect(result.advice.spec.encode).toEqual(expect.objectContaining({ x: 'quarter', y: 'revenue' }))
  })
})
