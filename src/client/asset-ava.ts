/** Lazy browser engine registered for the small DSH client adapter. */
import { GPTVis } from '@antv/gpt-vis/dist/esm/index.js'
import { THEME_MAP } from '@antv/gpt-vis/dist/esm/util/theme.js'

// This asset owns its bundled theme registry; improve axis contrast in both host themes.
for (const [name, color] of [['default', '#4b5563'], ['dark', '#c3cee0']] as const) {
  THEME_MAP[name].axis = { labelFill: color, labelOpacity: 1, titleFill: color, titleOpacity: 1 }
}

interface AssetGlobal {
  __DshAntvAvaAssets__?: Record<string, unknown>
}

const host = globalThis as unknown as AssetGlobal
const assets = host.__DshAntvAvaAssets__ ?? (host.__DshAntvAvaAssets__ = {})
assets.ava = { GPTVis }
