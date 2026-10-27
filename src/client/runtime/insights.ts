import type { AvaDocument } from '../ava-source.ts'
import type { AvaAnalysis } from '../ava-analysis.ts'
import { loadAsset } from '../asset-loader.ts'
const cache = new Map<string, Promise<AvaAnalysis>>()
export function loadInsights(document: AvaDocument): Promise<AvaAnalysis> {
  const key = document.syntax
  let pending = cache.get(key)
  if (!pending) {
    pending = loadAsset('insights').then(asset => {
      const engine = asset as { analyze(document: AvaDocument): AvaAnalysis }
      if (typeof engine.analyze !== 'function') throw new Error('Statistics engine unavailable')
      return engine.analyze(document)
    }).catch(error => { cache.delete(key); throw error })
    if (cache.size >= 32) cache.delete(cache.keys().next().value!)
    cache.set(key, pending)
  }
  return pending
}
