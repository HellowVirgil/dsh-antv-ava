import { analyzeAvaDocument } from './ava-analysis.ts'
const host = globalThis as unknown as { __DshAntvAvaAssets__?: Record<string, unknown> }
const assets = host.__DshAntvAvaAssets__ ?? (host.__DshAntvAvaAssets__ = {})
assets.insights = { analyze: analyzeAvaDocument }
