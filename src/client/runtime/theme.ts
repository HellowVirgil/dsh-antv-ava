import { useLayoutEffect, useState, type RefObject } from 'react'
export type ChartTheme = 'default' | 'dark'
function sample(container: HTMLElement): ChartTheme {
  let node: HTMLElement | null = container
  while (node) {
    const match = getComputedStyle(node).backgroundColor.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)$/)
    if (match && Number(match[4] ?? 1) > 0) return (Number(match[1]) * 299 + Number(match[2]) * 587 + Number(match[3]) * 114) / 1000 < 128 ? 'dark' : 'default'
    node = node.parentElement
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
}
export function useChartTheme(ref: RefObject<HTMLElement>): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>('default')
  useLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const update = (): void => setTheme(sample(container))
    update()
    const observer = new MutationObserver(update)
    let node: HTMLElement | null = container
    while (node) { observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] }); node = node.parentElement }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', update)
    return () => { observer.disconnect(); media.removeEventListener?.('change', update) }
  }, [ref])
  return theme
}
