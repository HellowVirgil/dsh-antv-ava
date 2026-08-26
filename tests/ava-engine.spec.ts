import { describe, expect, it } from 'vitest'
import { analyzeAvaDocument } from '../src/client/ava-analysis.ts'
import type { AvaDocument } from '../src/client/ava-source.ts'

describe('AVA engine adapter', () => {
  it('derives AVA insight fields from GPT-Vis tabular syntax', () => {
    const document: AvaDocument = {
      mode: 'chart',
      chartType: 'line',
      syntax: `vis line
data
  - time Q1
    value 128
  - time Q2
    value 164
  - time Q3
    value 191
  - time Q4
    value 226
title "季度收入趋势"`,
      title: '季度收入趋势',
      language: 'zh-CN',
    }

    const result = analyzeAvaDocument(document)
    expect(result.fields).toEqual([
      expect.objectContaining({ id: 'time', role: 'dimension' }),
      expect.objectContaining({ id: 'value', role: 'measure' }),
    ])
    expect(Array.isArray(result.patterns)).toBe(true)
  })
})
