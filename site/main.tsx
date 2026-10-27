import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AvaBlock } from '../src/client/AvaBlock.tsx'
import { ensureAvaStyles } from '../src/client/styles.ts'

ensureAvaStyles()
const inline = `ava
language zh-CN
narrative
  headline 季度收入持续增长
  paragraph
    text Q4 收入达到
    metric-value 226万
chart
  vis line
  data
    - time Q1
      value 128
    - time Q2
      value 164
    - time Q3
      value 191
    - time Q4
      value 226
  title 季度收入趋势
  axisXTitle 季度
  axisYTitle 收入（万元）`
const json = 'ava json\n'+JSON.stringify({chartType:'column',config:{type:'column',data:[{category:'办公用品',value:15900},{category:'家具',value:3507.16}],title:'品类收入',axisYTitle:'万元'}})
function Preview(){
  const params=new URLSearchParams(location.search)
  const [source,setSource]=useState(''),[mode,setMode]=useState(params.get('mode')??'result'),[dark,setDark]=useState(params.get('theme')==='dark'),[error,setError]=useState('')
  useEffect(()=>{void fetch('/ava-demo').then(r=>r.json()).then(v=>setSource(v.source)).catch(e=>setError(String(e)))},[])
  useEffect(()=>{document.documentElement.style.backgroundColor=dark?'rgb(20,25,34)':'rgb(255,255,255)';document.documentElement.style.colorScheme=dark?'dark':'light';document.body.style.color=dark?'#e4eaf4':'#253044'},[dark])
  return <main style={{maxWidth:900,margin:'auto',padding:'24px 20px 60px',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif',lineHeight:1.7}}>
    <header style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap',borderBottom:'1px solid #8885',paddingBottom:18,marginBottom:24}}><strong>DSH × AVA · 实现预览</strong>
      <label>展示路径 <select value={mode} onChange={e=>setMode(e.target.value)}><option value="result">v4 真实查询结果</option><option value="inline">旧围栏兼容</option><option value="json">v4 JSON 配置</option></select></label>
      <button onClick={()=>setDark(v=>!v)}>{dark?'浅色':'深色'}</button>
    </header>
    <p style={{fontSize:13,opacity:.75}}>{mode === 'result' ? '合成数据 · 结果由 AVA 4.0.0-beta.2 / DuckDB 实际计算，数据集已关闭。当前页面通过保存的快照回放。' : '合成数据 · 内联格式兼容示例，本视图不会执行查询或调用模型。'}</p>
    {error?<p role="alert">{error}</p>:mode==='result'&&!source?<p role="status">读取结果…</p>:<AvaBlock key={mode} source={mode==='result'?source:mode==='inline'?inline:json} settled />}
  </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
