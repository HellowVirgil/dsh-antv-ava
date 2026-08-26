import { describe, expect, it } from 'vitest'
import {
  MAX_AVA_SOURCE_LENGTH,
  parseAvaSource,
} from '../src/client/ava-source.ts'

const VALID = `ava
language zh-CN
chart
  vis line
  data
    - time Q1
      value 128
    - time Q2
      value 164
    - time Q3
      value 191
  title "季度收入趋势"`

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
  vis line
  data
    - time Q1
      value 128
    - time Q2
      value 164
  title "季度收入趋势"`

describe('parseAvaSource', () => {
  it('parses official GPT-Vis syntax inside the unified AVA document', () => {
    const result = parseAvaSource(VALID, true)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.mode).toBe('chart')
      if (result.value.mode !== 'chart') throw new Error('expected chart mode')
      expect(result.value.chartType).toBe('line')
      expect(result.value.title).toBe('季度收入趋势')
      expect(result.value.syntax).toContain('value 164')
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
    expect(combined.value.chart.syntax).toContain('time Q2')
  })

  it('keeps streaming narrative visible until the supplementary chart is complete', () => {
    const result = parseAvaSource(`${UNIFIED_NARRATIVE}\nchart\n  vis line\n  data\n`, false)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.mode).toBe('ntv')
  })

  it('rejects an invalid settled section in the unified document', () => {
    const result = parseAvaSource(`${UNIFIED_NARRATIVE}\nchart\n  vis line\n  data`, true)
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

  it('progressively exposes only complete GPT-Vis lines while streaming', () => {
    const partial = `${VALID.replace('\n  title "季度收入趋势"', '')}\n    - time Q4\n      value 2`
    const result = parseAvaSource(partial, false)
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.mode !== 'chart') return
    expect(result.value.syntax).toContain('time Q4')
    expect(result.value.syntax).not.toContain('value 2')
  })

  it('rejects an unsupported settled GPT-Vis chart type', () => {
    const result = parseAvaSource(VALID.replace('vis line', 'vis unknown-chart'), true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('不支持')
  })

  it('rejects a settled chart without renderable data', () => {
    const result = parseAvaSource(`ava\nchart\n  vis line\n  data`, true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('可渲染数据')
  })

  it('enforces GPT-Vis field schemas for settled charts', () => {
    const result = parseAvaSource(VALID.replaceAll('time', 'quarter').replaceAll('value', 'revenue'), true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('字段约定')
  })

  it('requires numeric GPT-Vis measure values', () => {
    const result = parseAvaSource(VALID.replace('value 191', 'value 很高'), true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('字段约定')
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
    const result = parseAvaSource(`${VALID}\n${'x'.repeat(MAX_AVA_SOURCE_LENGTH)}`, true)
    expect(result.ok).toBe(false)
  })
})
