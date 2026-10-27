---
name: antv-ava
description: Convert supported quantitative facts into a unified dsh-antv-ava visualization that automatically uses AVA narrative text (NTV), a chart, or both. Use for data-heavy conclusions, KPI summaries, period-over-period interpretation, category breakdowns, shares, rankings, trends, distributions, outliers, correlations, or explicit chart requests in DSH.
---

# AntV AVA for DSH

Preserve only supported facts and emit one `ava` fenced block. Decide the useful sections without asking the user to choose a mode:

- Use `narrative` for readable KPI conclusions, changes, shares, and category breakdowns.
- Use `narrative` plus `chart` when visual shape materially improves a trend, distribution, comparison, ranking, correlation, or composition.
- Use only `chart` for an explicit chart request or when extra narrative would be redundant.

Put `narrative` before `chart` so text phrases appear first and GPT-Vis can grow the chart as complete data lines arrive.

```ava
ava
language zh-CN
narrative
  headline 本月订单保持增长
  paragraph
    metric-name 订单总量
    metric-value 1.98亿
    text ，同比增加
    delta positive 1,302.76万
    text ，增长
    ratio positive 7.05%
  heading 2 品类结构
  bullet
    dimension 办公用品：
    metric-value 1.59亿
    text ，占比
    proportion 80.47%
chart
  vis column
  data
    - category 办公用品
      value 15900
    - category 家具
      value 3507.16
  title "各品类订单规模"
  axisXTitle 品类
  axisYTitle "订单量（万）"
```

## Compose narrative phrases

Inside `narrative`, use optional `headline`, `heading 1..6 <text>`, `paragraph`, `bullet`, `section`, and `divider`. Indent them two spaces from the fence root. Indent phrases four spaces from the root.

Use:

- `text` and `strong` for connective prose.
- `metric-name`, `metric-value`, and `other-value` for metrics.
- `dimension`, `time`, `contribution`, `proportion`, and `trend` for AVA entities.
- `delta <positive|negative|equal>` for absolute change.
- `ratio <positive|negative|equal>` for change rate.

Treat assessment as direction, not desirability. Put punctuation in `text` phrases and keep phrase lines short enough to stream naturally.

## Compose chart data

Inside `chart`, indent official GPT-Vis syntax by two spaces and start with `vis <chart-type>`. Prefer `line`/`area` for trends, `column`/`bar` for comparisons and rankings, `pie` for a small part-to-whole composition, `scatter` for correlation, `histogram`/`boxplot`/`violin` for distributions, and `table` when exact lookup matters most.

Put `data` before display properties so complete items can render while generation continues. Use ASCII field ids, quote values containing spaces, keep quantitative values numeric, and put units in `title`, `axisXTitle`, or `axisYTitle`. Include a concise `title`; omit `theme`, `width`, and `height` because the plugin owns layout and live theme adaptation.

Follow GPT-Vis schemas exactly: `line/area` use `time,value[,group]`; `column/bar/pie/funnel/boxplot/violin` use `category,value[,group]`; `scatter` uses `x,y[,group]`; `radar` uses `name,value[,group]`; `sankey` uses `source,target,value`; `treemap` uses `name,value[,children]`; `word-cloud` uses `text,value`; `histogram` uses a simple numeric array; and `table` may use descriptive column keys.

## Preserve evidence

- Do not infer missing values, periods, or zeros.
- Preserve language, units, precision, and uncertainty.
- Do not mix incompatible units in one measure.
- Avoid repeating the same conclusion in narrative and chart text.
- Use ordinary prose when there is no useful quantitative structure.
- Never emit executable markup, secrets, local/private URLs, or unsupported claims.

Before finishing, verify narrative punctuation, assessment direction, proportion validity, GPT-Vis syntax, and chart data completeness.

## When AVA data tools are available

Open uploaded files directly with `ava_dataset_open` using their provided attachment path, unique filename, or attachmentId. Use workspace-relative paths for files in the current session; `./filename` explicitly selects a workspace file. Do not copy attachments or probe unrelated directories after an authorization error. Then inspect the actual schema and business definitions, then use `ava_query` to compute supported facts. Query results include saved result IDs and bounded previews; distinguish preview truncation from query truncation. Compute derived metrics in SQL and retain their units and denominators. Bind renderer fields to existing result columns with `ava_result_present`, and emit its returned `ava result` fence unchanged. Never invent result IDs, retype result numbers into chart data, or claim that a supplied inline snapshot was executed. Close datasets when finished; saved presentations remain readable.

For externally supplied AVA v4 chart specs, use `ava json` followed by the JSON config or `{ chartType, config }` object. Supported structured chart types are line, bar, column, pie, scatter, histogram, waterfall, and table. Preserve the existing line-based format when progressive phrase/row rendering is useful. Summary/T8 is a separate text format and must not be emitted as a JSON chart.
