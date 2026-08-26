import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const chartSpies = vi.hoisted(() => ({
  construct: vi.fn(),
  render: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('../src/client/asset-loader.ts', () => ({
  loadAvaAsset: () => Promise.resolve({
    analyze: () => ({ fields: [], patterns: [] }),
    GPTVis: class MockGPTVis {
      constructor(options: Record<string, unknown>) {
        chartSpies.construct(options)
      }

      render(spec: string): void {
        chartSpies.render(spec)
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
  vis line
  data
    - time Q1
      value 128
    - time Q2
      value 164
  title "季度收入趋势"`

afterEach(() => {
  cleanup()
  chartSpies.construct.mockClear()
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

  it('rerenders the same GPT-Vis instance with the matching live theme', async () => {
    document.documentElement.style.backgroundColor = 'rgb(255, 255, 255)'
    render(<AvaBlock source={COMBINED} settled />)

    await waitFor(() => {
      expect(chartSpies.render.mock.calls.at(-1)?.[0]).toContain('theme default')
    })

    document.documentElement.style.backgroundColor = 'rgb(18, 18, 20)'
    await waitFor(() => {
      expect(chartSpies.render.mock.calls.at(-1)?.[0]).toContain('theme dark')
    }, { timeout: 1_500 })
    expect(chartSpies.construct).toHaveBeenCalledTimes(1)
  })

  it('streams complete GPT-Vis data lines into one mounted renderer', async () => {
    const first = COMBINED.replace('    - time Q2\n      value 164\n', '')
    const view = render(<AvaBlock source={`${first}\n`} settled={false} />)
    await waitFor(() => expect(chartSpies.render).toHaveBeenCalled())
    expect(chartSpies.render.mock.calls.at(-1)?.[0]).toContain('time Q1')

    view.rerender(<AvaBlock source={`${COMBINED}\n`} settled={false} />)
    await waitFor(() => expect(chartSpies.render.mock.calls.at(-1)?.[0]).toContain('time Q2'))
    expect(chartSpies.construct).toHaveBeenCalledTimes(1)
  })
})
