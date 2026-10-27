import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/client/AvaBlock.tsx', () => ({
  AvaBlock: ({ source }: { source: string }) => <div data-testid="dom-ava">{source}</div>,
}))

import { installDomFenceRenderer } from '../src/client/dom-fence.tsx'

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

function codeBlock(raw: string, language: string, streaming = false): {
  row: HTMLElement
  block: HTMLElement
  label: HTMLElement
  code: HTMLElement
} {
  const row = document.createElement('div')
  if (streaming) row.setAttribute('data-streaming', '')
  const block = document.createElement('div')
  block.className = 'md-code-block'
  const banner = document.createElement('div')
  const label = document.createElement('span')
  label.textContent = language
  const copy = document.createElement('button')
  copy.textContent = '复制'
  banner.append(label, copy)
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.textContent = raw
  pre.appendChild(code)
  block.append(banner, pre)
  row.appendChild(block)
  return { row, block, label, code }
}

async function tick(): Promise<void> {
  await new Promise(resolve => window.setTimeout(resolve, 30))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('DOM fallback', () => {
  it.each(['代码块', 'Code block', 'Code'])('recognizes a validated result behind the DSH generic %s banner', async labelText => {
    const { row, block, label } = codeBlock(`ava result ${'a'.repeat(64)}\n`, labelText)
    label.parentElement!.setAttribute('data-code-block-banner', '')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('none')
      expect(row.querySelector('[data-testid="dom-ava"]')?.textContent).toContain('ava result')
    } finally { dispose() }
  })

  it('recognizes legacy inline AVA behind the new generic banner', async () => {
    const { row, block, label } = codeBlock(VALID, '代码块')
    label.parentElement!.setAttribute('data-code-block-banner', '')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try { await tick(); expect(block.style.display).toBe('none') } finally { dispose() }
  })

  it.each(['const example = "ava result abc"', 'ava result abc', 'ava json\n{invalid'])('leaves generic non-AVA or invalid content untouched', async raw => {
    const { row, block, label } = codeBlock(raw, '代码块')
    label.parentElement!.setAttribute('data-code-block-banner', '')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try { await tick(); expect(block.style.display).toBe(''); expect(row.querySelector('.dsh-antv-ava-dom')).toBeNull() } finally { dispose() }
  })

  it('honors an explicit non-AVA language even behind a generic banner', async () => {
    const { row, block, label, code } = codeBlock(`ava result ${'a'.repeat(64)}`, 'Code')
    code.className = 'language-text'
    label.parentElement!.setAttribute('data-code-block-banner', '')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try { await tick(); expect(block.style.display).toBe('') } finally { dispose() }
  })

  it('never remounts code blocks inside its own fallback or evidence views', async () => {
    const { row, block } = codeBlock(VALID, 'ava')
    row.className = 'dsh-antv-ava-dom'
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try { await tick(); expect(block.style.display).toBe(''); expect(document.querySelectorAll('.dsh-antv-ava-dom')).toHaveLength(1) } finally { dispose() }
  })

  it('takes over a settled ava fence', async () => {
    const { row, block } = codeBlock(VALID, 'ava')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('none')
      expect(row.querySelector('.dsh-antv-ava-dom')?.textContent).toContain('category A')
    } finally {
      dispose()
    }
  })

  it('ignores other fenced languages', async () => {
    const { row, block } = codeBlock('const x = 1', 'ts')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('')
      expect(row.querySelector('.dsh-antv-ava-dom')).toBeNull()
    } finally {
      dispose()
    }
  })

  it('renders an unlabeled streaming block once complete rows are available', async () => {
    const { row, block } = codeBlock(`${VALID}\n`, '', true)
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('none')
      expect(row.querySelector('.dsh-antv-ava-dom')).not.toBeNull()
    } finally {
      dispose()
    }
  })

  it('keeps an incomplete streaming document as the stock code block', async () => {
    const { row, block } = codeBlock('ava\nchart\n  vis line\n  data', '', true)
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('')
      expect(row.querySelector('.dsh-antv-ava-dom')).toBeNull()
    } finally {
      dispose()
    }
  })

  it('restores a content-detected streaming block when its settled label is not ava', async () => {
    const { row, block, label } = codeBlock(`${VALID}\n`, '', true)
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    try {
      await tick()
      expect(block.style.display).toBe('none')
      label.textContent = 'text'
      row.removeAttribute('data-streaming')
      await tick()
      expect(block.style.display).toBe('')
      expect(row.querySelector('.dsh-antv-ava-dom')).toBeNull()
    } finally {
      dispose()
    }
  })

  it('restores the original code block on dispose', async () => {
    const { row, block } = codeBlock(VALID, 'ava')
    document.body.appendChild(row)
    const dispose = installDomFenceRenderer()
    await tick()
    dispose()
    expect(block.style.display).toBe('')
    expect(row.querySelector('.dsh-antv-ava-dom')).toBeNull()
  })
})
