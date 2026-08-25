import React from 'react'
import { createRoot } from 'react-dom/client'
import { AvaBlock } from '../src/client/AvaBlock.tsx'
import { ensureAvaStyles } from '../src/client/styles.ts'

ensureAvaStyles()

const source = `ava
title AI 产品各阶段投入与收益
description 使用 AVA 自动推荐图表并提取数据洞察
purpose Comparison
language zh-CN
fields
  - id stage
    label 阶段
    type categorical
    role dimension
  - id input
    label 投入（人日）
    type quantitative
    role measure
  - id output
    label 收益指数
    type quantitative
    role measure
data
  - stage 调研
    input 20
    output 5
  - stage 原型
    input 45
    output 32
  - stage 试点
    input 65
    output 74
  - stage 上线
    input 80
    output 120`

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AvaBlock source={source} settled />
  </React.StrictMode>,
)
