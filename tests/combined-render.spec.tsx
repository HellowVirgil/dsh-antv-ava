import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const chartSpies = vi.hoisted(() => ({
  options: vi.fn(),
  render: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
}))

vi.mock('../src/client/asset-loader.ts', () => ({
  loadAvaAsset: () => Promise.resolve({
    analyze: () => ({
      advice: { type: 'line_chart', score: 1, spec: { type: 'line' } },
      patterns: [],
    }),
    Chart: class MockChart {
      options(spec: Record<string, unknown>): this {
        chartSpies.options(spec)
        return this
      }

      render(): Promise<unknown> {
        return chartSpies.render()
      }

      destroy(): void {
        chartSpies.destroy()
      }
    },
  }),
}))

import { AvaBlock } from '../src/client/AvaBlock.tsx'

const COMBINED = `ava
language zh-CN
narrative
  headline 季度收入持续增长
  paragraph
    text Q4 收入达到
    metric-value 226万
chart
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

afterEach(() => {
  cleanup()
  chartSpies.options.mockClear()
  chartSpies.render.mockClear()
  chartSpies.destroy.mockClear()
  document.documentElement.style.backgroundColor = ''
})

describe('unified AVA rendering', () => {
  it('places narrative and chart directly in one cardless conversation flow', () => {
    const { container } = render(<AvaBlock source={COMBINED} settled />)
    expect(screen.getByText('季度收入持续增长')).not.toBeNull()
    expect(screen.getByRole('heading', { name: '季度收入趋势' })).not.toBeNull()
    expect(container.querySelector('.dsh-antv-ava-flow')).not.toBeNull()
    expect(container.querySelector('.dsh-antv-ava-ntv')).not.toBeNull()
    expect(container.querySelector('.dsh-antv-ava-flow__chart--supplementary')).not.toBeNull()
    expect(container.querySelector('.dsh-antv-ava')).toBeNull()
    expect(container.querySelector('.dsh-antv-ava__toolbar')).toBeNull()
  })

  it('rerenders G2 with the matching theme when Harness changes appearance', async () => {
    document.documentElement.style.backgroundColor = 'rgb(255, 255, 255)'
    render(<AvaBlock source={COMBINED} settled />)

    await waitFor(() => {
      expect(chartSpies.options).toHaveBeenCalledWith(expect.objectContaining({ theme: 'classic' }))
    })

    document.documentElement.style.backgroundColor = 'rgb(18, 18, 20)'
    await waitFor(() => {
      expect(chartSpies.options.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ theme: 'classicDark' }))
    }, { timeout: 1_500 })
    expect(chartSpies.destroy).toHaveBeenCalled()
  })
})
