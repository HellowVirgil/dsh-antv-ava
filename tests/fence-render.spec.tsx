import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/client/AvaBlock.tsx', () => ({
  AvaBlock: ({ source }: { source: string }) => <div data-testid="ava">{source}</div>,
}))

import { renderAvaFence } from '../src/client/fence-render.tsx'

afterEach(cleanup)

const VALID = `ava
language zh-CN
chart
  vis column
  data
    - category A
      value 10
    - category B
      value 20
  title 对比`

describe('registry fence renderer', () => {
  it('renders a valid settled fence', () => {
    render(<>{renderAvaFence(VALID, 'k1', { source: { id: 's1', order: [1, 0, 0] } })}</>)
    expect(screen.getByTestId('ava').textContent).toContain('category A')
  })

  it('keeps invalid source visible and explains the problem', () => {
    render(<>{renderAvaFence('not ava', 'k2', { source: { id: 's2', order: [2, 0, 0] } })}</>)
    expect(screen.getByRole('alert').textContent).toContain('第一行')
    expect(document.body.textContent).toContain('not ava')
  })

  it('rejects executable markup before mounting the renderer', () => {
    render(<>{renderAvaFence(VALID.replace('title 对比', 'title <script>alert(1)</script>'), 'k3', { source: { id: 's3', order: [3, 0, 0] } })}</>)
    expect(screen.queryByTestId('ava')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('HTML/SVG')
  })
})
