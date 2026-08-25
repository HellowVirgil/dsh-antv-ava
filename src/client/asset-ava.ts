/** Lazy browser engine registered for the small DSH client adapter. */
import { Chart } from '@antv/g2'
import { analyzeAvaDocument } from './ava-analysis.ts'

interface AssetGlobal {
  __DshAntvAvaAssets__?: Record<string, unknown>
}

const host = globalThis as unknown as AssetGlobal
const assets = host.__DshAntvAvaAssets__ ?? (host.__DshAntvAvaAssets__ = {})
assets.ava = { analyze: analyzeAvaDocument, Chart }
