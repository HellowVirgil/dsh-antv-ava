import { createServer } from 'vite'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AnalysisRuntime } from '../runtime/lib/service.js'
import { resultHandler } from '../runtime/lib/index.js'

const directory = await mkdtemp(join(tmpdir(), 'ava-preview-'))
const runtime = new AnalysisRuntime({ roots: [directory], storageDir: join(directory, 'store') })
const source = join(directory, 'sales.csv')
await writeFile(source, 'product,month,revenue\n分析产品,2025-01,12000\n分析产品,2025-02,18000\n自动化产品,2025-01,8000\n自动化产品,2025-02,11000\n支持服务,2025-01,4000\n支持服务,2025-02,5500\n报表产品,2025-01,6000\n报表产品,2025-02,3000\n')
try {
  const opened = await runtime.open('preview', source)
  const result = await runtime.query('preview', opened.datasetId, `WITH monthly AS (
  SELECT product,
    SUM(CASE WHEN month = '2025-01' THEN revenue ELSE 0 END) AS jan,
    SUM(CASE WHEN month = '2025-02' THEN revenue ELSE 0 END) AS feb
  FROM data GROUP BY product
)
SELECT *, feb - jan AS delta,
  SUM(feb) OVER () AS total,
  SUM(feb-jan) OVER () AS change,
  SUM(feb-jan) OVER () / SUM(jan) OVER () AS rate
FROM monthly ORDER BY delta DESC`)
  const ref = columnId => ({ resultId: result.id, rowKey: '0', columnId })
  const presentation = await runtime.present('preview', {
    resultId: result.id, title: '营收增长，分析产品贡献最大',
    view: { chartType: 'bar', bindings: { category: 'product', value: 'delta' }, title: '各产品的营收变化', axisYTitle: '变化（美元）' },
    blocks: [
      { id: 'summary', kind: 'paragraph', phrases: [{kind:'text',text:'2 月营收为 '},{kind:'value',ref:ref('total'),format:'money',currency:'USD'},{kind:'text',text:'，较 1 月增长 '},{kind:'value',ref:ref('rate'),format:'percent'},{kind:'text',text:'。各产品的变化见下图；数据没有提供变化原因的证据。'}]},
      { id:'total',kind:'metric',label:'2 月营收',value:ref('total'),format:'money',currency:'USD' },
      { id:'change',kind:'metric',label:'净增长（美元）',value:ref('change') },
      { id:'rate',kind:'metric',label:'环比变化率',value:ref('rate'),format:'percent' },
      { id:'chart',kind:'chart',viewId:'chart' },
    ],
  })
  await runtime.close('preview', opened.datasetId)
  const handler = resultHandler(runtime)
  const server = await createServer({
    configFile:false,
    server:{host:'127.0.0.1',port:4179,strictPort:false},
    plugins:[{name:'ava-preview-assets',configureServer(server){
      server.middlewares.use(async (req,res,next)=>{
        const path=(req.url??'').split('?')[0]
        if(path==='/ava-demo'){
          res.setHeader('Content-Type','application/json');res.end(JSON.stringify({source:'ava result '+presentation.presentationId}));return
        }
        if(path?.startsWith('/plugins/dsh-antv-ava/results/')){await handler(req,res);return}
        if(['/plugins/dsh-antv-ava/assets/ava.js','/plugins/dsh-antv-ava/assets/insights.js'].includes(path)){
          res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('../lib/assets/'+path.split('/').at(-1),import.meta.url)));return
        }
        next()
      })
    }}],
  })
  const shutdown=async()=>{await server.close();await runtime.dispose();await rm(directory,{recursive:true,force:true});process.exit()}
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown)
  await server.listen()
  const address=server.httpServer.address()
  console.log('AVA implementation preview: http://127.0.0.1:'+address.port+'/site/index.html')
} catch(error){await runtime.dispose();await rm(directory,{recursive:true,force:true});throw error}
