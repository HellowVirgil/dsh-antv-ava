// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { definitions, resultHandler } from '../runtime/lib/index.js'
import type { AnalysisRuntime } from '../runtime/lib/service.js'

describe('DSH runtime boundary',()=>{
  it('derives ownership from the execution context, never model arguments',async()=>{
    const inspect=vi.fn().mockResolvedValue({schema:{}})
    const runtime={inspect} as unknown as AnalysisRuntime
    const tool=definitions(runtime).find(t=>t.name==='ava_dataset_inspect')!
    await expect(tool.execute({datasetId:'id',owner:'other'},{agent:{id:'actual'},signal:new AbortController().signal} as never)).rejects.toThrow('Unsupported')
    await expect(tool.execute({datasetId:'id'},{signal:new AbortController().signal} as never)).rejects.toThrow('session')
    await tool.execute({datasetId:'id'},{agent:{id:'actual'},signal:new AbortController().signal} as never)
    expect(inspect).toHaveBeenCalledWith('actual','id',false,expect.any(AbortSignal))
  })
  it('requires a capability and refuses cross-site reads',async()=>{
    const presentation=vi.fn()
    const handler=resultHandler({presentation} as unknown as AnalysisRuntime)
    for(const url of ['/plugins/dsh-antv-ava/results/../../secret','/plugins/dsh-antv-ava/results/'+'a'.repeat(64)]){
      const res={writeHead:vi.fn(),end:vi.fn()}
      await handler({url,method:'GET',headers:{'sec-fetch-site':'cross-site'}} as never,res as never)
      expect(res.writeHead).toHaveBeenCalledWith(404)
    }
    expect(presentation).not.toHaveBeenCalled()
  })
})
