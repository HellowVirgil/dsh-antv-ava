/** DSH browser entry: registry renderer when available, DOM fallback otherwise. */
import type { Context } from '@deepseek-ai/cordis'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { Key, ReactNode } from 'react'
import { prefetchAvaAsset } from './asset-loader.ts'
import { installDomFenceRenderer } from './dom-fence.tsx'
import { renderAvaFence, type AvaFenceContext } from './fence-render.tsx'
import { ensureAvaStyles } from './styles.ts'

type FenceExtension = {
  registerFenceRenderer?: (
    language: string,
    renderer: (raw: string, key: Key, context?: AvaFenceContext) => ReactNode,
  ) => () => void
}

export function apply(_ctx: Context): () => void {
  ensureAvaStyles()
  prefetchAvaAsset()
  const register = (primitives as unknown as FenceExtension).registerFenceRenderer
  const channel = typeof register === 'function' ? 'registry' : 'dom'
  console.info(`[dsh-antv-ava] client active; fence-channel=${channel}`)
  if (typeof register === 'function') return register('ava', renderAvaFence)
  return installDomFenceRenderer()
}

export { renderAvaFence }
export type { AvaFenceContext }
