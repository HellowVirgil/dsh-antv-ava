// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AnalysisRuntime } from '../runtime/lib/service.js'

describe('AVA v4 execution and saved results',()=>{
  let directory:string, runtime:AnalysisRuntime, datasetId:string, resultId:string
  beforeAll(async()=>{
    directory=await mkdtemp(join(tmpdir(),'ava-integration-'))
    await writeFile(join(directory,'sales.csv'),'product,revenue\nA,12\nB,4\nA,8\n')
    runtime=new AnalysisRuntime({roots:[directory],storageDir:join(directory,'store')})
    const opened=await runtime.open('owner',join(directory,'sales.csv'))
    datasetId=opened.datasetId
    expect(JSON.stringify(opened.schema)).not.toContain(directory)
  },30000)
  afterAll(async()=>{await runtime?.dispose();if(directory)await rm(directory,{recursive:true,force:true})})
  it('computes exact aggregation and stores immutable results',async()=>{
    const result=await runtime.query('owner',datasetId,'SELECT product, SUM(revenue) AS revenue FROM data GROUP BY product ORDER BY product')
    resultId=result.id
    expect(result.rows).toEqual([{product:'A',revenue:20},{product:'B',revenue:4}])
    expect(result.truncated).toBe(false)
    result.rows[0]!.revenue=999
    const presented=await runtime.present('owner',{resultId,view:{chartType:'bar',bindings:{category:'product',value:'revenue'}}})
    expect((await runtime.presentation(presented.presentationId)).results[0]!.rows[0]!.revenue).toBe(20)
  })
  it('enforces session ownership and a read-only SQL boundary',async()=>{
    await expect(runtime.inspect('other',datasetId)).rejects.toThrow('session')
    await expect(runtime.query('owner',datasetId,'DROP VIEW data')).rejects.toThrow()
    await expect(runtime.present('other',{resultId,view:{chartType:'table',bindings:{}}})).rejects.toThrow('session')
    await expect(runtime.query('owner',datasetId,"SELECT * FROM read_csv('/etc/passwd')")).rejects.toThrow()
  })
  it('keeps private runtime snapshots out of allowed data roots',async()=>{
    await expect(runtime.open('other',join(directory,'store','results',resultId+'.json'))).rejects.toThrow('storage')
  })
  it('does not publish a presentation after cancellation',async()=>{
    const before=await readdir(join(directory,'store','presentations'))
    const abort=new AbortController();abort.abort()
    await expect(runtime.present('owner',{resultId,view:{chartType:'table',bindings:{}}},abort.signal)).rejects.toThrow()
    expect(await readdir(join(directory,'store','presentations'))).toEqual(before)
  })
  it('reports truncation and preserves unsafe integer precision',async()=>{
    const result=await runtime.query('owner',datasetId,'SELECT * FROM data',{maxRows:1})
    expect(result.truncated).toBe(true);expect(result.truncatedBy).toEqual(['rows'])
    const exact=await runtime.query('owner',datasetId,'SELECT 9007199254740993::BIGINT AS value')
    expect(exact.rows[0]!.value).toBe('9007199254740993')
  })
  it('allows old snapshots to replay after dataset closure and runtime recreation',async()=>{
    const presentation=await runtime.present('owner',{resultId,view:{chartType:'table',bindings:{}}})
    await runtime.close('owner',datasetId)
    const next=new AnalysisRuntime({roots:[directory],storageDir:join(directory,'store')})
    try{expect((await next.presentation(presentation.presentationId)).results[0]!.rows[0]!.revenue).toBe(20)}finally{await next.dispose()}
  })
  it('rejects paths outside roots even through symlinks',async()=>{
    await symlink('/etc/hosts',join(directory,'outside.csv'))
    await expect(runtime.open('owner',join(directory,'outside.csv'))).rejects.toThrow('outside')
  })
  it('terminates cancelled native queries and does not persist their results',async()=>{
    const opened=await runtime.open('owner',join(directory,'sales.csv'))
    const before=await readdir(join(directory,'store','results'))
    const abort=new AbortController()
    const query=runtime.query('owner',opened.datasetId,'SELECT SUM(a.i*b.i) FROM range(1000000) a(i), range(1000000) b(i)',{},abort.signal)
    setTimeout(()=>abort.abort(),50)
    await expect(query).rejects.toThrow('cancelled')
    expect(await readdir(join(directory,'store','results'))).toEqual(before)
    await expect(runtime.inspect('owner',opened.datasetId)).rejects.toThrow('reopen')
  },15000)
  it('loads JSON data without model credentials',async()=>{
    const path=join(directory,'data.json');await writeFile(path,JSON.stringify([{value:1.5},{value:2.5}]))
    const opened=await runtime.open('owner',path)
    const result=await runtime.query('owner',opened.datasetId,'SELECT SUM(value) AS total FROM data')
    expect(result.rows[0]!.total).toBe(4)
    expect((await readFile(join(directory,'store','results',result.id+'.json'),'utf8')).includes('apiKey')).toBe(false)
  },15000)
  it('retains explicit business definitions and versions future results',async()=>{
    const opened=await runtime.open('owner',join(directory,'sales.csv'))
    await runtime.semantics('owner',opened.datasetId,{description:'Revenue is measured in USD.'})
    const metadata=await runtime.inspect('owner',opened.datasetId,true) as {semantic:{description:string};profile:unknown}
    expect(metadata.semantic.description).toContain('USD')
    expect(metadata.profile).toBeDefined()
    const result=await runtime.query('owner',opened.datasetId,'SELECT SUM(revenue) AS total FROM data')
    expect(result.semanticVersion).toMatch(/^[a-f0-9]{64}$/)
    expect(result.evidence.semantics).toContain('USD')
    await runtime.close('owner',opened.datasetId)
  },15000)
  it('loads Excel sheets and computes actual numeric results',async()=>{
    const path=join(directory,'sales.xlsx')
    await writeFile(path,await readFile(new URL('./fixtures/sales.xlsx',import.meta.url)))
    const opened=await runtime.open('owner',path)
    const result=await runtime.query('owner',opened.datasetId,'SELECT SUM(revenue) AS total FROM Sales')
    expect(result.rows).toEqual([{total:20}])
  },30000)
})
