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

describe('parseAvaSource', () => {
  it('parses a complete AVA document', () => {
    const result = parseAvaSource(VALID, true)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.purpose).toBe('Trend')
      expect(result.value.fields).toHaveLength(2)
      expect(result.value.data[1]).toEqual({ quarter: 'Q2', revenue: 164 })
    }
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
