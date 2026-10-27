import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { answer } from './fixtures/answer.ts'
const engine=vi.hoisted(()=>({render:vi.fn(),destroy:vi.fn(),analyze:vi.fn(),fail:false}))
vi.mock('../src/client/asset-loader.ts',()=>({
  loadAvaAsset:()=>Promise.resolve({analyze:engine.analyze,GPTVis:class { render(config:unknown){engine.render(config);if(engine.fail)throw new Error('chart failed')} destroy(){engine.destroy()} }}),
}))
import { AnswerView, AnswerReferenceView } from '../src/client/components/AnswerView.tsx'
import { AvaBlock } from '../src/client/AvaBlock.tsx'
afterEach(()=>{cleanup();engine.render.mockReset();engine.analyze.mockReset();engine.fail=false;vi.unstubAllGlobals();document.documentElement.style.backgroundColor=''})
describe('result presentation',()=>{
  it('keeps exact table values and declares untrusted inline provenance',async()=>{
    render(<AnswerView document={answer()} />)
    await waitFor(()=>expect(engine.render).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button',{name:'数据'}))
    expect(screen.getByRole('table').textContent).toContain('20')
    expect(screen.getByText('回答提供的快照，执行来源未验证')).not.toBeNull()
  })
  it('keeps the table and narrative available when the chart fails',async()=>{
    engine.fail=true;render(<AnswerView document={answer()} />)
    await waitFor(()=>expect(screen.getByRole('table')).not.toBeNull())
    expect(screen.getByText('A 的收入为')).not.toBeNull()
    expect(screen.getByRole('button',{name:'重试图表'})).not.toBeNull()
  })
  it('does not query or compute statistics when the theme changes or a message remounts',async()=>{
    const source='ava json\n'+JSON.stringify({type:'bar',data:[{category:'A',value:20}]})
    const view=render(<AvaBlock source={source} settled />)
    await waitFor(()=>expect(engine.render).toHaveBeenCalled())
    document.documentElement.style.backgroundColor='rgb(10,10,10)'
    await waitFor(()=>expect(engine.render.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({theme:'dark'})))
    view.unmount();render(<AvaBlock source={source} settled />)
    await waitFor(()=>expect(engine.render.mock.calls.length).toBeGreaterThan(2))
    expect(engine.analyze).not.toHaveBeenCalled()
  })
  it('shows successful empty results separately from errors',()=>{
    const doc=answer(),r=doc.results[0]!;r.rows=[];r.rowKeys=[];r.returnedRows=0;r.totalRows=0;doc.blocks=[{id:'chart',kind:'chart',viewId:'chart'}]
    render(<AnswerView document={doc} />)
    expect(screen.getByText('查询成功，当前条件下没有数据。')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('does not let an old reference response overwrite a new one',async()=>{
    let finishOld: ((value:unknown)=>void)|undefined
    vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve})).mockResolvedValueOnce({ok:true,text:async()=>JSON.stringify({...answer(),title:'新结果'})}))
    const view=render(<AnswerReferenceView id={'a'.repeat(64)} />)
    view.rerender(<AnswerReferenceView id={'b'.repeat(64)} />)
    await screen.findByText('新结果')
    finishOld?.({ok:true,text:async()=>JSON.stringify({...answer(),title:'旧结果'})})
    await waitFor(()=>expect(screen.queryByText('旧结果')).toBeNull())
  })
})
