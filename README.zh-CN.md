<p align="center">
  🌐 简体中文 | <a href="./README.md">English</a>
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  让 DeepSeek Harness 自动将数据回答呈现为流式叙事文本、AntV 图表，或两者的自然组合。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-antv-ava?logo=npm&color=cb3837"></a>
  <a href="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-antv-ava?logo=npm"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/npm/l/dsh-antv-ava"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AntV_AVA-3.4.1-1677ff" alt="AntV AVA 3.4.1">
  <img src="https://img.shields.io/badge/AntV_GPT--Vis-1.0.0-1677ff" alt="AntV GPT-Vis 1.0.0">
  <img src="https://img.shields.io/badge/streaming-supported-16a34a" alt="支持流式渲染">
  <img src="https://img.shields.io/badge/theme-light%20%7C%20dark-8b5cf6" alt="支持亮色与暗色主题">
</p>

## 效果预览

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="dsh-antv-ava 在 DSH 对话中渲染数据解读和 AntV 图表" width="100%">
</p>

叙事文本和图表会直接融入模型回复，不使用独立卡片。文本按短语逐步出现，GPT-Vis 图表在获得可用数据后就开始呈现，并在生成过程中持续更新。

## 核心功能

- 自动选择表达方式：模型根据问题和数据决定使用 NTV、图表或两者组合。
- 流式数据解读：指标、变化率、占比、分类明细和结论按短语增量渲染。
- 流式 AntV 图表：模型生成 GPT-Vis 官方 syntax，完整数据行会在回答结束前持续更新同一个图表实例。
- AVA 数据洞察：生成稳定后，AVA 会分析表格数据中的趋势、异常、变化、占比和相关性等显著模式。
- 对话流设计：继承 DSH 的字体、字号、行高、颜色、宽度和 Markdown 间距。
- 实时主题适配：切换亮色或暗色主题后，图表坐标轴、标签和网格线会同步更新，无需刷新页面。
- 语义数据表达：支持指标高亮、涨跌箭头、绝对变化、变化率、贡献度和占比微图。
- 按需加载：只有回答包含图表时才加载 AVA/GPT-Vis 图表引擎。
- 安全解析：限制输入规模，并拒绝可执行标记、危险 URL 和私网资源。

## 安装

```bash
dsh plugin --profile web add dsh-antv-ava
```

安装后重启 `dsh web`，再重新加载页面。插件会自动向模型注入所需的输出约定，普通用户不需要额外安装 Skill，也不需要手写 DSL。

## 使用方式

安装完成后直接用自然语言提问即可。

### 数据解读

```text
解读以下经营数据，给出适合快速阅读的核心结论：
本月订单总量 1.98 亿，同比增长 7.05%……
```

模型通常会返回流式 NTV，突出指标、变化、占比和分类结论。

### 数据解读和图表

```text
分析 Q1 到 Q4 的收入变化，并选择合适的方式进行可视化：
Q1 128 万、Q2 164 万、Q3 191 万、Q4 226 万。
```

当趋势或比较通过图形更容易理解时，模型会组合叙事文本和图表。

### 只生成图表

```text
把下面的数据画成趋势图，只需要图表：……
```

用户明确要求图表时，模型可以仅输出图表，不重复生成解释文本。

## 自动输出规则

| 内容特点 | 常见结果 |
| --- | --- |
| KPI、同比环比、占比、分类拆解、数据结论 | NTV |
| 趋势、比较、分布、排名、构成需要图形辅助 | NTV + Chart |
| 明确要求只画图，或文字解释没有额外价值 | Chart |

这是模型的自动选择，用户无需了解内部格式。

## 支持的数据表达

NTV 支持：

- 主指标、次指标和维度值
- 时间描述和趋势结论
- 绝对变化和变化率
- 占比、贡献度和占比微图
- headline、1–6 级标题、段落、列表、分节和分隔线

图表使用 GPT-Vis syntax，支持：

- 折线图、面积图、柱状图、条形图、饼图、散点图、雷达图、漏斗图、瀑布图和双轴图
- 直方图、箱线图、小提琴图、矩形树图、桑基图、韦恩图、水波图、词云和表格
- 在适合数据解读时，也可以使用 GPT-Vis 支持的其他关系图

## 可选：安装 Skill

插件自身已经可以工作。只有当 Agent 环境会读取 `~/.agents/skills`，并且希望复杂数据任务获得更严格的事实保真和表达选择指导时，才需要安装仓库内附带的 Skill。

```bash
mkdir -p ~/.agents/skills/antv-ava
cp SKILL.md ~/.agents/skills/antv-ava/SKILL.md
```

## 高级：统一 AVA 格式

模型在一个 `ava` 围栏中按需生成 `narrative`、`chart` 或两者：

````markdown
```ava
ava
language zh-CN
narrative
  headline 季度收入持续增长
  paragraph
    text Q4 收入达到
    metric-value 226万
    text ，较 Q1 增长
    ratio positive 76.6%
chart
  vis line
  data
    - time Q1
      value 128
    - time Q4
      value 226
  title "季度收入趋势"
  axisXTitle 季度
  axisYTitle "收入（万元）"
```
````

## 适用范围

适合有明确数字依据的 KPI、经营分析、趋势、占比、排名和分类拆解。插件不会为了可视化补造数值，也不会执行模型输出的任意 HTML、SVG 或脚本。

缺少有效数字结构的流程、层级和路线图，更适合使用信息图类插件。

## 从源码安装

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install
pnpm run check
dsh plugin --profile web add "link:$PWD"
```

## 开发

```bash
pnpm test
pnpm build
pnpm run verify:pack
```

## License

MIT。AntV AVA 和 AntV GPT-Vis 也采用 MIT License。
