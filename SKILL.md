---
name: antv-ava
description: Convert supported quantitative facts into a unified dsh-antv-ava visualization that automatically uses AVA narrative text (NTV), a chart, or both. Use for data-heavy conclusions, KPI summaries, period-over-period interpretation, category breakdowns, shares, rankings, trends, distributions, outliers, correlations, or explicit chart requests in DSH.
---

# AntV AVA for DSH

Preserve only supported facts and emit one `ava` fenced block. Decide the useful sections without asking the user to choose a mode:

- Use `narrative` for readable KPI conclusions, changes, shares, and category breakdowns.
- Use `narrative` plus `chart` when visual shape materially improves a trend, distribution, comparison, ranking, correlation, or composition.
- Use only `chart` for an explicit chart request or when extra narrative would be redundant.

Put `narrative` before `chart` so text phrases stream before chart data is complete.

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
  title 各品类订单规模
  purpose Comparison
  fields
    - id category
      label 品类
      type categorical
      role dimension
    - id orders
      label 订单量（万）
      type quantitative
      role measure
  data
    - category 办公用品
      orders 15900
    - category 家具
      orders 3507.16
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

Inside `chart`, indent the existing chart DSL by two spaces. Require `title`, `fields`, and `data`. Choose `Comparison`, `Trend`, `Distribution`, `Rank`, `Proportion`, or `Composition`. Use ASCII field ids, 2–12 fields, complete rows, units in labels, and numeric quantitative values.

## Preserve evidence

- Do not infer missing values, periods, or zeros.
- Preserve language, units, precision, and uncertainty.
- Do not mix incompatible units in one measure.
- Avoid repeating the same conclusion in narrative and chart insight text.
- Use ordinary prose when there is no useful quantitative structure.
- Never emit executable markup, secrets, local/private URLs, or unsupported claims.

Before finishing, verify narrative punctuation, assessment direction, proportion validity, and chart row completeness.
