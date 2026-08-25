import type { AvaDocument } from './ava-source.ts'

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
  advice: {
    type: string
    score: number
    spec: Record<string, unknown>
  }
  patterns: AvaPattern[]
}

export interface AvaChart {
  options(spec: Record<string, unknown>): AvaChart
  render(): Promise<unknown>
  destroy(): void
}

export interface AvaEngine {
  analyze(document: AvaDocument): AvaAnalysis
  Chart: new (options: Record<string, unknown>) => AvaChart
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
  if (existing?.Chart !== undefined && existing.analyze !== undefined) {
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
      if (engine?.Chart === undefined || engine.analyze === undefined) {
        reject(new Error('AntV 引擎脚本已加载，但没有注册 AVA/G2 API'))
        return
      }
      resolve(engine)
    }
    script.onerror = () => reject(new Error('AntV AVA 引擎加载失败，请确认插件资源路由可用并重启 dsh web'))
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
