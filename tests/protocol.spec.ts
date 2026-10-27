import { describe, expect, it } from 'vitest'
import { answer } from './fixtures/answer.ts'
import { validateAnswer, validateResult, resolveValue, formatValue } from '../src/protocol/answer.ts'
import { configFromView, validateChartConfig } from '../src/protocol/chart.ts'
import { boundedJson } from '../src/protocol/guards.ts'
import { startAnswerStream, reduceAnswerEvent } from '../src/protocol/events.ts'
import { parseAvaSource } from '../src/client/ava-source.ts'
import { csvText } from '../src/client/components/ResultTable.tsx'

describe('stable result protocol', () => {
  it('derives chart and narrative values from the same result', () => {
    const doc=validateAnswer(answer()), result=doc.results[0]!
    expect(configFromView(doc.views[0]!,result).data).toEqual([{category:'A',value:20},{category:'B',value:4}])
    expect(resolveValue({resultId:result.id,rowKey:'0',columnId:'revenue'},doc.results)).toBe(20)
  })
  it('rejects unknown versions and forged references', () => {
    expect(()=>validateAnswer({...answer(),schemaVersion:4})).toThrow('version')
    const doc=answer();doc.views[0]!.resultId='other'
    expect(()=>validateAnswer(doc)).toThrow('unknown result')
    expect(()=>resolveValue({resultId:'result-1',rowKey:'other',columnId:'revenue'},answer().results)).toThrow('row')
  })
  it('rejects duplicate identity and ambiguous/missing columns', () => {
    const result=answer().results[0]!
    expect(()=>validateResult({...result,rowKeys:['0','0']})).toThrow('Duplicate')
    expect(()=>validateResult({...result,rows:[{product:'A'},result.rows[1]]})).toThrow('missing')
    expect(()=>validateResult({...result,returnedRows:3})).toThrow('bounds')
  })
  it('keeps large integers exact and falls back instead of coercing them for charts', () => {
    const doc=answer(),r=doc.results[0]!
    r.rows[0]!.revenue='9007199254740993'
    expect(formatValue(validateResult(r).rows[0]!.revenue!)).toBe('9007199254740993')
    expect(()=>configFromView(doc.views[0]!,r)).toThrow('precision-safe')
  })
  it('does not turn partial results into a composition chart', () => {
    const doc=answer();doc.results[0]!.truncated=true
    expect(()=>configFromView({...doc.views[0]!,chartType:'pie'},doc.results[0]!)).toThrow('truncated')
  })
  it.each([
    {type:'bar',data:[{category:'A',value:2}],onClick:'alert(1)'},
    {type:'summary',data:[]},
    {type:'pie',data:[{category:'A',value:-1}]},
    {type:'line',data:[{time:'A',value:'2'}]},
    {type:'bar',data:[{category:'<img src=x onerror=alert(1)>',value:2}]},
    {type:'bar',data:[{category:'A',value:2}],title:'javascript:alert(1)'},
  ])('rejects incompatible or executable chart configuration', input=>expect(()=>validateChartConfig(input)).toThrow())
  it('blocks prototype keys and excessive nesting', () => {
    expect(()=>boundedJson('{"__proto__":{"x":1}}')).toThrow('Unsafe')
    expect(()=>boundedJson('['.repeat(18)+'0'+']'.repeat(18))).toThrow('nesting')
  })
  it('accepts only complete JSON during streaming and accepts final EOF', () => {
    const source='ava json\n'+JSON.stringify({type:'bar',data:[{category:'A',value:2}]})
    expect(parseAvaSource(source,false).ok).toBe(true)
    expect(parseAvaSource(source.slice(0,-1),false)).toEqual({ok:false,reason:undefined})
    expect(parseAvaSource(source,true).ok).toBe(true)
  })
  it('accepts host reference fences, not arbitrary paths', () => {
    expect(parseAvaSource('ava result '+'a'.repeat(64),true).ok).toBe(true)
    expect(parseAvaSource('ava result ../../secret',true).ok).toBe(false)
  })
  it('adapts the official v4 ChartSpec envelope and never consumes its HTML', () => {
    const config={type:'bar',data:[{category:'A',value:2}]}
    const source='ava json\n'+JSON.stringify({chartType:'bar',config,html:'<script>never execute</script>'})
    const result=parseAvaSource(source,true)
    expect(result.ok && result.value.mode === 'json-chart' && result.value.config).toEqual(config)
    expect(parseAvaSource(source.replace('"chartType":"bar"','"chartType":"line"'),true).ok).toBe(false)
  })
  it('escapes spreadsheet formulas while preserving numeric negatives', () => {
    const csv=csvText(['x','y'],[{x:'=WEBSERVICE("evil")',y:-3}])
    expect(csv).toContain("'=WEBSERVICE")
    expect(csv).toContain('"-3"')
  })
})

describe('answer stream ordering', () => {
  it('resynchronizes gaps, ignores duplicates and terminal late results', () => {
    const base={runId:'run',documentId:'answer-1'}
    let state=startAnswerStream('run','answer-1')
    state=reduceAnswerEvent(state,{...base,seq:1,revision:0,type:'snapshot',document:answer()})
    expect(reduceAnswerEvent(state,{...base,seq:1,revision:0,type:'error',message:'duplicate'})).toBe(state)
    state=reduceAnswerEvent(state,{...base,seq:3,revision:1,type:'paragraph.replace',blockId:'text',phrases:[]})
    expect(state.needsSnapshot).toBe(true)
    expect(reduceAnswerEvent(state,{...base,seq:4,revision:1,type:'complete'}).status).toBe('receiving')
    state=reduceAnswerEvent(state,{...base,seq:5,revision:1,type:'snapshot',document:{...answer(),revision:1}})
    state=reduceAnswerEvent(state,{...base,seq:6,revision:1,type:'cancelled'})
    expect(reduceAnswerEvent(state,{...base,seq:7,revision:2,type:'snapshot',document:{...answer(),revision:2}})).toBe(state)
  })
  it('isolates new runs from old asynchronous responses', () => {
    const state=startAnswerStream('new','answer-1')
    expect(reduceAnswerEvent(state,{runId:'old',documentId:'answer-1',seq:1,revision:0,type:'snapshot',document:answer()})).toBe(state)
  })
  it('preserves the last valid snapshot when the next payload is invalid', () => {
    const base={runId:'run',documentId:'answer-1'}
    const state=reduceAnswerEvent(startAnswerStream('run','answer-1'),{...base,seq:1,revision:0,type:'snapshot',document:answer()})
    const next=reduceAnswerEvent(state,{...base,seq:2,revision:1,type:'snapshot',document:{...answer(),schemaVersion:9} as never})
    expect(next.needsSnapshot).toBe(true)
    expect(next.document).toBe(state.document)
  })
})
