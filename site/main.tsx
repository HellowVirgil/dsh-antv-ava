import React from 'react'
import { createRoot } from 'react-dom/client'
import { AvaBlock } from '../src/client/AvaBlock.tsx'
import { ensureAvaStyles } from '../src/client/styles.ts'

ensureAvaStyles()

const source = `ava
language zh-CN
narrative
  headline 本月订单量稳步增长，办公用品贡献超八成增量
  paragraph
    metric-name 订单总量
    metric-value 1.98亿
    text ，同比上月同期增加
    delta positive 1,302.76万
    text ，增长
    ratio positive 7.05%
  heading 2 品类结构
  bullet
    dimension 办公用品：
    metric-value 1.59亿
    text ，占比
    proportion 80.47%
    text ；同比增加
    delta positive 1,058.96万
    text ，增长
    ratio positive 7.13%
  bullet
    dimension 家具：
    metric-value 3,507.16万
    text ，占比
    proportion 17.74%
    text ；同比增加
    delta positive 220.05万
    text ，增长
    ratio positive 6.69%
  bullet
    dimension 设备：
    metric-value 354.29万
    text ，占比
    proportion 1.79%
    text ；同比增加
    delta positive 23.75万
    text ，增长
    ratio positive 7.19%`

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AvaBlock source={source} settled />
  </React.StrictMode>,
)
