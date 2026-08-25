/**
 * Fallback renderer for DSH builds without the fence-registry extension.
 * It only takes over known code-block surfaces whose settled label is exactly
 * `ava`, or an unlabeled streaming surface whose body already starts with the
 * AVA DSL header.
 */
import { createRoot, type Root } from 'react-dom/client'
import { renderAvaFenceNode } from './fence-render.tsx'

const SELECTORS = '.md-code-block, .code-block, .code-block-small'
const STREAMING = '[data-streaming]'
const PROCESSED = 'data-antv-ava-rendered'
const CONTAINER_CLASS = 'dsh-antv-ava-dom'
const SWEEP_MS = 1000
const SURFACE_HOPS = 4
const BLOCK_CONTENT_SELECTOR = 'p,ul,ol,dl,table,h1,h2,h3,h4,h5,h6,blockquote,hr,img,figure'

interface Mount {
  root: Root
  block: HTMLElement
  container: HTMLElement
  raw: string
  settled: boolean
}

function plausibleSurface(candidate: Element): boolean {
  const pres = candidate.querySelectorAll('pre')
  if (pres.length !== 1) return false
  const pre = pres[0]
  if (pre === undefined) return false
  for (const element of candidate.querySelectorAll(BLOCK_CONTENT_SELECTOR)) {
    if (!pre.contains(element)) return false
  }
  return true
}

function hasAvaLabel(block: Element): boolean {
  const pre = block.querySelector('pre')
  for (const element of block.querySelectorAll('*')) {
    if (element.childElementCount !== 0) continue
    if (pre !== null && pre.contains(element)) continue
    const text = element.textContent?.trim() ?? ''
    if (text.toLowerCase() === 'ava') return true
  }
  return false
}

function rawOf(block: Element): string {
  return block.querySelector('pre')?.textContent ?? ''
}

function settledOf(block: Element): boolean {
  return block.closest(STREAMING) === null
}

function structuralSurface(pre: HTMLElement, scope: ParentNode): HTMLElement | null {
  let element = pre.parentElement
  for (let hop = 0; element !== null && element !== scope && hop < SURFACE_HOPS; hop += 1) {
    if (hasAvaLabel(element) && plausibleSurface(element)) return element
    element = element.parentElement
  }
  return null
}

function candidates(scope: ParentNode = document): HTMLElement[] {
  const found = new Set<HTMLElement>()
  for (const element of scope.querySelectorAll<HTMLElement>(SELECTORS)) {
    if (element.parentElement?.closest(SELECTORS) !== null) continue
    if (plausibleSurface(element)) found.add(element)
  }
  for (const pre of scope.querySelectorAll<HTMLElement>('pre')) {
    if (pre.closest(SELECTORS) !== null) continue
    const surface = structuralSurface(pre, scope)
    if (surface !== null) found.add(surface)
  }
  return [...found]
}

export function installDomFenceRenderer(): () => void {
  if (typeof document === 'undefined') return () => {}
  const mounts = new Map<HTMLElement, Mount>()
  let scheduled = false

  const unmount = (block: HTMLElement): void => {
    const mount = mounts.get(block)
    if (mount === undefined) return
    mounts.delete(block)
    mount.root.unmount()
    mount.container.remove()
    block.style.display = ''
    block.removeAttribute(PROCESSED)
  }

  const renderBlock = (block: HTMLElement): void => {
    const settled = settledOf(block)
    const labeledAva = hasAvaLabel(block)
    const raw = rawOf(block)
    // DSH omits the fence language while a reply streams, but still renders
    // banner actions such as the Copy button. Identify an unsettled fence by
    // its completed DSL header instead of treating arbitrary banner text as
    // the language. Once settled, require the real ava label so a
    // different fence that happened to contain similar text is restored.
    const looksLikeStreamingAva = !settled && /^\s*ava(?:\s+(?:ntv|chart))?\s*\r?\n/i.test(raw)
    if ((settled && !labeledAva) || (!settled && !looksLikeStreamingAva)) {
      unmount(block)
      return
    }

    const node = renderAvaFenceNode(raw, `dom-ava-${mounts.size}`, settled)
    if (node === null) {
      if (settled) unmount(block)
      return
    }

    const existing = mounts.get(block)
    if (existing !== undefined) {
      if (!existing.container.isConnected && block.parentElement !== null) block.after(existing.container)
      block.style.display = 'none'
      block.setAttribute(PROCESSED, '')
      if (existing.raw !== raw || existing.settled !== settled) {
        existing.raw = raw
        existing.settled = settled
        existing.root.render(node)
      }
      return
    }

    if (block.parentElement === null) return
    const container = document.createElement('div')
    container.className = CONTAINER_CLASS
    block.after(container)
    const root = createRoot(container)
    const mount: Mount = { root, block, container, raw, settled }
    mounts.set(block, mount)
    block.style.display = 'none'
    block.setAttribute(PROCESSED, '')
    root.render(node)
  }

  const scan = (): void => {
    for (const block of [...mounts.keys()]) {
      if (!block.isConnected) unmount(block)
    }
    for (const block of candidates()) renderBlock(block)
  }

  const schedule = (): void => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      scan()
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-streaming', 'class'],
  })
  const interval = window.setInterval(scan, SWEEP_MS)
  scan()

  return () => {
    observer.disconnect()
    window.clearInterval(interval)
    for (const block of [...mounts.keys()]) unmount(block)
  }
}
