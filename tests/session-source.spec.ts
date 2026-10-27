// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AnalysisRuntime, type FileReference, type OpenedDataset } from '../runtime/lib/service.js'
import { definitions } from '../runtime/lib/index.js'

describe('session-scoped AVA sources', () => {
  let directory: string, launch: string, workspace: string, uploads: string, storage: string
  let runtime: AnalysisRuntime
  let files: FileReference[]
  let read: ReturnType<typeof vi.fn>
  let host: { reflect: { get(name: string): unknown } }
  let services: Record<string, unknown>
  let exec: ReturnType<typeof execution>
  const hostPath = (ref: FileReference): string => join(uploads, ref.attachmentId.slice(7), ref.name)
  function execution(id: string, cwd?: string, refs: FileReference[] = files) {
    return {
      agent: { id, ctx: host, session: {
        header: { id, ...(cwd ? { cwd } : {}) },
        deriveMessages: () => [{ role:'user',source:{kind:'user'},content:refs.map(attachment => ({type:'file',attachment})) }],
      } },
      signal: new AbortController().signal,
    }
  }
  async function upload(name: string, bytes: Uint8Array): Promise<FileReference> {
    const ref = { attachmentId:'sha256:'+createHash('sha256').update(bytes).digest('hex'),name,bytes:bytes.byteLength }
    await mkdir(join(uploads,ref.attachmentId.slice(7)),{recursive:true})
    await writeFile(hostPath(ref),bytes)
    files.push(ref)
    return ref
  }
  async function open(args: Record<string,unknown>, context = exec): Promise<OpenedDataset> {
    const tool = definitions(runtime,host as never).find(t=>t.name==='ava_dataset_open')!
    return await tool.execute(args,context as never) as OpenedDataset
  }
  beforeEach(async () => {
    directory=await mkdtemp(join(tmpdir(),'ava-source-access-'))
    launch=join(directory,'launch');workspace=join(directory,'workspace');uploads=join(directory,'uploads');storage=join(directory,'store')
    for(const p of [launch,workspace,uploads])await mkdir(p)
    files=[]
    read=vi.fn((ref:FileReference) => (async function*(){ yield await readFile(hostPath(ref)) })())
    services={attachments:{root:uploads,fileHostPath:hostPath,readFileStream:read}}
    host={reflect:{get:name=>services[name]}}
    exec=execution('owner',workspace)
    runtime=new AnalysisRuntime({roots:[launch],storageDir:storage})
  })
  afterEach(async()=>{await runtime.dispose();await rm(directory,{recursive:true,force:true})})

  it('opens an admitted XLSX host path outside the launch directory without copying it into the workspace',async()=>{
    const ref=await upload('sales.xlsx',await readFile(new URL('./fixtures/sales.xlsx',import.meta.url)))
    const dataset=await open({path:hostPath(ref)})
    const result=await runtime.query('owner',dataset.datasetId,'SELECT SUM(revenue) AS total FROM Sales')
    expect(result.rows).toEqual([{total:20}])
    expect(dataset.datasetVersion).toBe(ref.attachmentId.slice(7))
    expect(read).toHaveBeenCalledWith(ref,exec.signal)
    expect(await readdir(workspace)).toEqual([])
  },30000)

  it('accepts the session attachment ID and an unambiguous filename',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    for(const args of [{attachmentId:ref.attachmentId},{path:'sales.csv'}]){
      const dataset=await open(args)
      expect((await runtime.query('owner',dataset.datasetId,'SELECT amount FROM data')).rows).toEqual([{amount:7}])
      await runtime.close('owner',dataset.datasetId)
    }
  })

  it('resolves workspace-relative paths from the session header and preserves configured roots',async()=>{
    await writeFile(join(workspace,'sales.csv'),'amount\n23\n')
    const dataset=await open({path:'./sales.csv'})
    expect((await runtime.query('owner',dataset.datasetId,'SELECT amount FROM data')).rows).toEqual([{amount:23}])
    await writeFile(join(launch,'shared.csv'),'amount\n9\n')
    expect((await open({path:join(launch,'shared.csv')})).source).toBe('shared.csv')
  })

  it('does not leak one session workspace grant to another session',async()=>{
    await writeFile(join(workspace,'sales.csv'),'amount\n23\n')
    await open({path:'sales.csv'})
    const otherWorkspace=join(directory,'other');await mkdir(otherWorkspace)
    await expect(open({path:join(workspace,'sales.csv')},execution('other',otherWorkspace,[]))).rejects.toThrow('outside')
  })

  it('rejects another session attachment by both path and ID',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    const other=execution('other',workspace,[])
    await expect(open({path:hostPath(ref)},other)).rejects.toThrow('not available')
    await expect(open({attachmentId:ref.attachmentId},other)).rejects.toThrow('not present')
    expect(read).not.toHaveBeenCalled()
  })

  it('uses typed user file blocks rather than paths quoted in text or tool/plugin messages',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    exec.agent.session.deriveMessages=()=>[
      {role:'user',source:{kind:'plugin'},content:[{type:'file',attachment:ref}]},
      {role:'tool',source:{kind:'tool'},content:[{type:'file',attachment:ref}]},
    ]
    await expect(open({path:hostPath(ref)})).rejects.toThrow('not available')
    expect(read).not.toHaveBeenCalled()
  })

  it('keeps managed attachment access scoped even if a broad configured root contains the store',async()=>{
    await runtime.dispose();runtime=new AnalysisRuntime({roots:[directory],storageDir:storage})
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    await expect(open({path:hostPath(ref)},execution('other',workspace,[]))).rejects.toThrow('not available')
  })

  it('rejects ambiguous upload names and supports explicit workspace disambiguation',async()=>{
    await upload('sales.csv',Buffer.from('amount\n7\n'));await upload('sales.csv',Buffer.from('amount\n8\n'))
    await writeFile(join(workspace,'sales.csv'),'amount\n99\n')
    await expect(open({path:'sales.csv'})).rejects.toThrow('Multiple')
    const dataset=await open({path:'./sales.csv'})
    expect((await runtime.query('owner',dataset.datasetId,'SELECT amount FROM data')).rows).toEqual([{amount:99}])
  })

  it('rejects workspace symlinks escaping to unrelated or managed files',async()=>{
    const outside=join(directory,'outside.csv');await writeFile(outside,'amount\n99\n')
    await symlink(outside,join(workspace,'outside.csv'))
    await expect(open({path:'./outside.csv'})).rejects.toThrow('outside')
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    await symlink(hostPath(ref),join(workspace,'alias.csv'))
    await expect(open({path:'./alias.csv'})).rejects.toThrow('not available')
  })

  it('restores historical attachment grants through the async session observation and releases the lease',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    exec.agent.session.deriveMessages=()=>[]
    const dispose=vi.fn()
    const observe=vi.fn().mockResolvedValue({header:{id:'owner'},events:[{type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'file',attachment:ref}]}}],[Symbol.dispose]:dispose})
    services.sessionQuery={observeSession:observe}
    expect((await open({attachmentId:ref.attachmentId})).source).toBe('sales.csv')
    expect(observe).toHaveBeenCalledWith('owner',{signal:exec.signal,projectionMode:'none'})
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('refuses a mismatched observation identity and releases its lease',async()=>{
    const dispose=vi.fn()
    services.sessionQuery={observeSession:vi.fn().mockResolvedValue({header:{id:'other'},events:[],[Symbol.dispose]:dispose})}
    await expect(open({attachmentId:'sha256:'+'a'.repeat(64)})).rejects.toThrow('identity')
    expect(dispose).toHaveBeenCalledOnce();expect(read).not.toHaveBeenCalled()
  })

  it('does not read unsupported or oversized attachments',async()=>{
    const ref=await upload('large.csv',Buffer.from('amount\n7\n'))
    ref.bytes=21*1024*1024
    await expect(open({attachmentId:ref.attachmentId})).rejects.toThrow('20 MiB')
    files=[];const unsupported=await upload('note.txt',Buffer.from('text'))
    exec=execution('owner',workspace)
    await expect(open({attachmentId:unsupported.attachmentId})).rejects.toThrow('Supported file types')
    expect(read).not.toHaveBeenCalled()
  })

  it('verifies attachment content before creating a dataset snapshot',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    await writeFile(hostPath(ref),'amount\n8\n')
    await expect(open({attachmentId:ref.attachmentId})).rejects.toThrow('integrity')
    expect(await readdir(join(storage,'sources'))).toEqual([])
  })

  it('cleans up when attachment reading is cancelled',async()=>{
    const ref=await upload('sales.csv',Buffer.from('amount\n7\n'))
    const abort=new AbortController();exec.signal=abort.signal
    const closed=vi.fn()
    read.mockImplementation(()=>(async function*(){try{yield Buffer.from('amount\n');abort.abort();yield Buffer.from('7\n')}finally{closed()}})())
    await expect(open({attachmentId:ref.attachmentId})).rejects.toThrow()
    expect(closed).toHaveBeenCalledOnce()
    expect(await readdir(join(storage,'sources'))).toEqual([])
  })

  it('does not accept model-provided authorization fields or ambiguous selectors',async()=>{
    await expect(open({path:'sales.csv',roots:[directory]})).rejects.toThrow('Unsupported')
    await expect(open({path:'sales.csv',attachmentId:'sha256:'+'a'.repeat(64)})).rejects.toThrow('exactly one')
    await expect(open({})).rejects.toThrow('exactly one')
  })
})
