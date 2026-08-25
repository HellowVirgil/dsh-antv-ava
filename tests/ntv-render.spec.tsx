import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AvaBlock } from '../src/client/AvaBlock.tsx'
import { ensureAvaStyles } from '../src/client/styles.ts'

const NTV = `ava ntv
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
  text ）`

afterEach(cleanup)

describe('AVA NTV renderer', () => {
  it('uses the host Markdown typography tokens and spacing rhythm', () => {
    ensureAvaStyles()
    const css = document.head.querySelector('style[data-plugin-css="dsh-antv-ava"]')?.textContent ?? ''
    for (const token of ['--dsw-font-markdown-h1', '--dsw-font-markdown-h2', '--dsw-font-markdown-h3', '--dsw-font-markdown-h4', '--dsw-font-markdown-small']) {
      expect(css).toContain(token)
    }
    expect(css).toContain('margin:16px 0')
    expect(css).toContain('padding-left:18px')
    expect(css).toContain('margin-top:6px')
    expect(css).toContain('.dsh-antv-ava-flow{position:relative;min-width:0;margin:0')
    expect(css).not.toContain('.dsh-antv-ava{')
    expect(css).not.toContain('dsh-antv-ava__toolbar')
  })

  it('renders semantic entities, assessments, headings, bullets, and a proportion micro chart', () => {
    const { container } = render(<AvaBlock source={NTV} settled />)
    expect(screen.getByText('从商品类别来看').closest('h2')).not.toBeNull()
    expect(screen.getByText('办公用品：').closest('li')).not.toBeNull()
    expect(screen.getByText('1.98亿').getAttribute('data-entity-type')).toBe('metric_value')
    expect(screen.getByText('+1,302.76万').classList.contains('dsh-antv-ava-ntv__entity--positive')).toBe(true)
    expect(screen.getByText('7.05%').classList.contains('dsh-antv-ava-ntv__entity--positive')).toBe(true)
    expect(container.querySelector('[data-entity-type="proportion"] [role="img"]')).not.toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('.dsh-antv-ava')).toBeNull()
    expect(container.querySelector('.dsh-antv-ava__toolbar')).toBeNull()
    expect(container.querySelector('.dsh-antv-ava-ntv-shell')).not.toBeNull()
  })

  it('marks an incremental NTV document as streaming', () => {
    const { container } = render(<AvaBlock source={`${NTV}\n`} settled={false} />)
    expect(container.querySelector('[data-stream-state="streaming"]')).not.toBeNull()
    expect(screen.queryByText('streaming')).toBeNull()
  })
})
