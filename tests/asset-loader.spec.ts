import { afterEach, describe, expect, it, vi } from 'vitest'
afterEach(()=>{delete (window as unknown as {__DshAntvAvaAssets__?:unknown}).__DshAntvAvaAssets__;document.head.querySelectorAll('script').forEach(s=>s.remove());vi.resetModules()})
describe('retryable asset loading',()=>{
  it('shares a pending load and allows retry after a failed script',async()=>{
    const {loadAvaAsset}=await import('../src/client/asset-loader.ts')
    const first=loadAvaAsset(), second=loadAvaAsset()
    const failures=Promise.allSettled([first,second])
    expect(document.head.querySelectorAll('script')).toHaveLength(1)
    document.head.querySelector('script')!.dispatchEvent(new Event('error'))
    expect((await failures).every(r=>r.status==='rejected')).toBe(true)
    const retry=loadAvaAsset()
    ;(window as unknown as {__DshAntvAvaAssets__:unknown}).__DshAntvAvaAssets__={ava:{GPTVis:class{}}}
    document.head.querySelector('script')!.dispatchEvent(new Event('load'))
    expect((await retry).GPTVis).toBeTypeOf('function')
  })
  it('loads statistics only when requested and uses the separate asset URL',async()=>{
    const {loadAsset}=await import('../src/client/asset-loader.ts')
    expect(document.head.querySelector('script')).toBeNull()
    const promise=loadAsset('insights');const failure=promise.catch(()=>null)
    expect(document.head.querySelector('script')!.src).toContain('/assets/insights.js')
    document.head.querySelector('script')!.dispatchEvent(new Event('error'));await failure
  })
})
