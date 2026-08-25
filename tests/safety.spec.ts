import { describe, expect, it } from 'vitest'
import {
  MAX_AVA_SOURCE_LENGTH,
  parseAvaSource,
} from '../src/client/ava-source.ts'

const VALID = `ava
title 季度收入趋势
purpose Trend
language zh-CN
fields
  - id quarter
    label 季度
    type temporal
    role dimension
  - id revenue
    label 收入（万元）
    type quantitative
    role measure
data
  - quarter Q1
    revenue 128
  - quarter Q2
    revenue 164
  - quarter Q3
    revenue 191`

const UNIFIED_NARRATIVE = `ava
language zh-CN
narrative
  headline 订单保持增长
  paragraph
    metric-name 订单总量
    metric-value 1.98亿
    text ，同比增长
    ratio positive 7.05%`

const UNIFIED_CHART = `chart
  title 季度收入趋势
  purpose Trend
  fields
    - id quarter
      label 季度
      type temporal
      role dimension
    - id revenue
      label 收入（万元）
      type quantitative
      role measure
  data
    - quarter Q1
      revenue 128
    - quarter Q2
      revenue 164`

describe('parseAvaSource', () => {
  it('parses a complete AVA document', () => {
    const result = parseAvaSource(VALID, true)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.mode).toBe('chart')
      if (result.value.mode !== 'chart') throw new Error('expected chart mode')
      expect(result.value.purpose).toBe('Trend')
      expect(result.value.fields).toHaveLength(2)
      expect(result.value.data[1]).toEqual({ quarter: 'Q2', revenue: 164 })
    }
  })

  it('maps NTV phrases to the AVA NarrativeTextSpec schema', () => {
    const result = parseAvaSource(`ava ntv
language zh-CN
paragraph
  metric-name 数量
  metric-value 1.98亿
  text ，同比上月同期
  delta positive 1,302.76万
  text （
  ratio positive 7.05%
  text ）
heading 2 从商品类别来看
bullet
  dimension 办公用品：
  metric-name 数量
  metric-value 1.59亿
  text （占比
  proportion 80.47%
  text ）`, true)

    expect(result.ok).toBe(true)
    if (!result.ok || result.value.mode !== 'ntv') return
    expect(result.value.spec).toEqual(expect.objectContaining({ sections: expect.any(Array) }))
    const json = JSON.stringify(result.value.spec)
    for (const entityType of ['metric_name', 'metric_value', 'delta_value', 'ratio_value', 'dim_value', 'proportion']) {
      expect(json).toContain(`\"entityType\":\"${entityType}\"`)
    }
    expect(json).toContain('\"assessment\":\"positive\"')
    expect(json).toContain('\"origin\":0.8047')
  })

  it('infers narrative, chart, and combined output from unified sections', () => {
    const narrative = parseAvaSource(UNIFIED_NARRATIVE, true)
    expect(narrative.ok && narrative.value.mode).toBe('ntv')

    const chart = parseAvaSource(`ava\nlanguage zh-CN\n${UNIFIED_CHART}`, true)
    expect(chart.ok && chart.value.mode).toBe('chart')

    const combined = parseAvaSource(`${UNIFIED_NARRATIVE}\n${UNIFIED_CHART}`, true)
    expect(combined.ok && combined.value.mode).toBe('combined')
    if (!combined.ok || combined.value.mode !== 'combined') return
    expect(combined.value.narrative.spec.headline?.phrases[0]?.value).toBe('订单保持增长')
    expect(combined.value.chart.data).toHaveLength(2)
  })

  it('keeps streaming narrative visible until the supplementary chart is complete', () => {
    const result = parseAvaSource(`${UNIFIED_NARRATIVE}\nchart\n  title 尚未完成\n`, false)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.mode).toBe('ntv')
  })

  it('rejects an invalid settled section in the unified document', () => {
    const result = parseAvaSource(`${UNIFIED_NARRATIVE}\nchart\n  title 缺少字段和数据`, true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('chart 区段无效')
  })

  it('progressively exposes only complete NTV phrase lines', () => {
    const result = parseAvaSource(`ava ntv
paragraph
  text 已完成
  metric-value 1.9`, false)
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.mode !== 'ntv') return
    const json = JSON.stringify(result.value.spec)
    expect(json).toContain('已完成')
    expect(json).not.toContain('1.9')
  })

  it('rejects malformed settled NTV entity commands', () => {
    const result = parseAvaSource(`ava ntv
paragraph
  ratio upward 7.05%`, true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('无法识别')
  })

  it('progressively returns complete rows while streaming', () => {
    const partial = `${VALID}\n  - quarter Q4\n    revenue 2`
    const result = parseAvaSource(partial, false)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.data).toHaveLength(3)
  })

  it('requires every settled row to contain every field', () => {
    const result = parseAvaSource(`${VALID}\n  - quarter Q4`, true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('revenue')
  })

  it('rejects non-numeric measure values', () => {
    const result = parseAvaSource(VALID.replace('revenue 191', 'revenue 很高'), true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('数值')
  })

  it.each([
    'javascript:alert(1)',
    '<script>alert(1)</script>',
    '<svg onload=alert(1)>',
    'file:///etc/passwd',
    'http://127.0.0.1:3000/private',
    'http://192.168.1.2/secret',
  ])('rejects dangerous model-authored content: %s', fragment => {
    const result = parseAvaSource(VALID.replace('季度收入趋势', fragment), true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBeDefined()
  })

  it('caps source size', () => {
    const result = parseAvaSource(`${VALID}\ndescription ${'x'.repeat(MAX_AVA_SOURCE_LENGTH)}`, true)
    expect(result.ok).toBe(false)
  })
})
