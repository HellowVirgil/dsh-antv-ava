const PLUGIN_ID = 'dsh-antv-ava'
interface AssetGlobal { __DshAntvAvaAssets__?: Record<string, unknown> }
export interface AvaChart { render(config: string | Record<string, unknown>): void; destroy(): void }
export interface AvaEngine {
  GPTVis: new (options: { container: HTMLElement; height?: number; locale?: string; theme?: 'default' | 'dark'; wrapper?: boolean }) => AvaChart
}
export function avaAssetUrl(name: 'ava' | 'insights' = 'ava'): string {
  const graph = (window as unknown as { __DSH_BOOT__?: { entries?: Array<{ id?: string; rev?: string }> } }).__DSH_BOOT__
  const rev = graph?.entries?.find(entry => entry.id === PLUGIN_ID)?.rev
  return `/plugins/${PLUGIN_ID}/assets/${name}.js${rev === undefined ? '' : `?rev=${encodeURIComponent(rev)}`}`
}
const pending = new Map<string, Promise<unknown>>()
export function loadAsset(name: 'ava' | 'insights'): Promise<unknown> {
  const existing = (window as unknown as AssetGlobal).__DshAntvAvaAssets__?.[name]
  if (existing) return Promise.resolve(existing)
  const current = pending.get(name)
  if (current) return current
  const promise = new Promise<unknown>((resolve, reject) => {
    const script = document.createElement('script')
    let timer: ReturnType<typeof setTimeout>
    const fail = (): void => { clearTimeout(timer); script.remove(); reject(new Error('AntV 资源加载失败，可重试加载。')) }
    script.src = avaAssetUrl(name); script.async = true
    script.onload = () => {
      clearTimeout(timer)
      const engine = (window as unknown as AssetGlobal).__DshAntvAvaAssets__?.[name]
      if (!engine) fail(); else resolve(engine)
    }
    script.onerror = fail
    timer = setTimeout(fail, 20_000)
    document.head.appendChild(script)
  }).catch(reason => { pending.delete(name); throw reason })
  pending.set(name, promise)
  return promise
}
export async function loadAvaAsset(): Promise<AvaEngine> {
  const value = await loadAsset('ava') as AvaEngine
  if (typeof value.GPTVis !== 'function') {
    pending.delete('ava')
    delete (window as unknown as AssetGlobal).__DshAntvAvaAssets__?.ava
    throw new Error('GPT-Vis API unavailable')
  }
  return value
}
export function prefetchAvaAsset(): void {
  if (typeof document === 'undefined') return
  const href = avaAssetUrl()
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) return
  const link = document.createElement('link'); link.rel = 'prefetch'; link.as = 'script'; link.href = href
  document.head.appendChild(link)
}
