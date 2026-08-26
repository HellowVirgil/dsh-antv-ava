import type { AvaDocument, AvaField } from './ava-source.ts'

const PLUGIN_ID = 'dsh-antv-ava'
const ASSET_DIR = `/plugins/${PLUGIN_ID}/assets`

interface BootGraphLike {
  entries?: Array<{ id?: string; rev?: string }>
}

interface AssetGlobal {
  __DshAntvAvaAssets__?: Record<string, unknown>
}

export interface AvaPattern {
  type: string
  [key: string]: unknown
}

export interface AvaAnalysis {
  fields: AvaField[]
  patterns: AvaPattern[]
}

export interface AvaChart {
  render(config: string | Record<string, unknown>): void
  destroy(): void
}

export interface AvaEngine {
  analyze(document: AvaDocument): AvaAnalysis
  GPTVis: new (options: {
    container: HTMLElement
    height?: number
    locale?: string
    theme?: 'default' | 'dark'
    wrapper?: boolean
  }) => AvaChart
}

export function avaAssetUrl(): string {
  const graph = (window as unknown as { __DSH_BOOT__?: BootGraphLike }).__DSH_BOOT__
  const rev = graph?.entries?.find(entry => entry.id === PLUGIN_ID)?.rev
  const suffix = rev === undefined ? '' : `?rev=${encodeURIComponent(rev)}`
  return `${ASSET_DIR}/ava.js${suffix}`
}

let pending: Promise<AvaEngine> | undefined

export function loadAvaAsset(): Promise<AvaEngine> {
  if (pending !== undefined) return pending
  const existing = (window as unknown as AssetGlobal).__DshAntvAvaAssets__?.ava as AvaEngine | undefined
  if (existing?.GPTVis !== undefined && existing.analyze !== undefined) {
    pending = Promise.resolve(existing)
    return pending
  }
  pending = new Promise<AvaEngine>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = avaAssetUrl()
    script.async = true
    script.onload = () => {
      const assets = (window as unknown as AssetGlobal).__DshAntvAvaAssets__ ?? {}
      const engine = assets.ava as AvaEngine | undefined
      if (engine?.GPTVis === undefined || engine.analyze === undefined) {
        reject(new Error('AntV 引擎脚本已加载，但没有注册 AVA/GPT-Vis API'))
        return
      }
      resolve(engine)
    }
    script.onerror = () => reject(new Error('AntV AVA/GPT-Vis 引擎加载失败，请确认插件资源路由可用并重启 dsh web'))
    document.head.appendChild(script)
  })
  return pending
}

export function prefetchAvaAsset(): void {
  if (typeof document === 'undefined') return
  const href = avaAssetUrl()
  if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`) !== null) return
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'script'
  link.href = href
  document.head.appendChild(link)
}
