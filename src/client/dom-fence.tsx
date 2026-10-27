/**
 * Fallback renderer for DSH builds without the fence-registry extension.
 * Prefer an explicit AVA language. DSH 0.2 hides unknown language names behind
 * a localized generic banner; those surfaces need a valid AVA document too.
 */
import { createRoot, type Root } from 'react-dom/client'
import { renderAvaFenceNode } from './fence-render.tsx'
import { parseAvaSource } from './ava-source.ts'

const SELECTORS = '.md-code-block, .code-block, .code-block-small'
const STREAMING = '[data-streaming]'
const PROCESSED = 'data-antv-ava-rendered'
const CONTAINER_CLASS = 'dsh-antv-ava-dom'
const SWEEP_MS = 1000
const SURFACE_HOPS = 4
const GENERIC_LABELS = new Set(['代码块', 'code block', 'code'])
const BLOCK_CONTENT_SELECTOR = 'p,ul,ol,dl,table,h1,h2,h3,h4,h5,h6,blockquote,hr,img,figure'

interface Mount {
  key: string
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
  const language = declaredLanguage(block)
  if (language !== undefined) return language === 'ava'
  const pre = block.querySelector('pre')
  for (const element of block.querySelectorAll('*')) {
    if (element.childElementCount !== 0) continue
    if (pre !== null && pre.contains(element)) continue
    const text = element.textContent?.trim() ?? ''
    if (text.toLowerCase() === 'ava') return true
  }
  return false
}

function declaredLanguage(block: Element): string | undefined {
  for (const node of [block, ...block.querySelectorAll('pre,code')]) {
    const attribute = node.getAttribute('data-language') ?? node.getAttribute('data-lang')
    if (attribute !== null && attribute.trim()) return attribute.trim().toLowerCase()
    const match = [...node.classList].find(name => name.startsWith('language-'))
    if (match) return match.slice('language-'.length).toLowerCase()
  }
  return undefined
}

function hasGenericBanner(block: Element): boolean {
  if (declaredLanguage(block) !== undefined) return false
  const banner = block.querySelector('[data-code-block-banner]')
  if (!banner) return false
  return [...banner.querySelectorAll('*')].some(node => node.childElementCount === 0
    && node.closest('button') === null
    && GENERIC_LABELS.has(node.textContent?.trim().toLowerCase() ?? ''))
}

function hasAvaHeader(raw: string): boolean {
  return /^\s*ava(?:[ \t]+(?:ntv|chart|json|answer))?[ \t]*\r?\n/i.test(raw)
    || /^\s*ava[ \t]+result[ \t]+[a-f0-9]{64}[ \t]*(?:\r?\n)?$/i.test(raw)
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
    if ((hasAvaLabel(element) || hasGenericBanner(element)) && plausibleSurface(element)) return element
    element = element.parentElement
  }
  return null
}

function candidates(scope: ParentNode = document): HTMLElement[] {
  const found = new Set<HTMLElement>()
  for (const element of scope.querySelectorAll<HTMLElement>(SELECTORS)) {
    if (element.closest(`.${CONTAINER_CLASS}`) !== null) continue
    if (element.parentElement?.closest(SELECTORS) !== null) continue
    if (plausibleSurface(element)) found.add(element)
  }
  for (const pre of scope.querySelectorAll<HTMLElement>('pre')) {
    if (pre.closest(`.${CONTAINER_CLASS}`) !== null) continue
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
  let nextMount = 0

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
    // A generic DSH banner loses the original grammar hint. Only opt in when
    // both the dedicated AVA header and the complete/partial parser agree.
    const generic = hasGenericBanner(block) && hasAvaHeader(raw)
    const inferred = generic ? parseAvaSource(raw, settled) : undefined
    const recognizedGeneric = inferred?.ok === true
    const looksLikeStreamingAva = !settled && declaredLanguage(block) === undefined && hasAvaHeader(raw)
    if ((settled && !labeledAva && !recognizedGeneric) || (!settled && !labeledAva && !looksLikeStreamingAva)) {
      unmount(block)
      return
    }

    const existing = mounts.get(block)
    if (existing?.raw === raw && existing.settled === settled && existing.container.isConnected) {
      block.style.display = 'none'
      block.setAttribute(PROCESSED, '')
      return
    }
    const key = existing?.key ?? `dom-ava-${nextMount++}`
    const node = renderAvaFenceNode(raw, key, settled, inferred)
    if (node === null) {
      if (settled) unmount(block)
      return
    }

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
    const mount: Mount = { key, root, block, container, raw, settled }
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
