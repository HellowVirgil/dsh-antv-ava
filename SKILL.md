---
name: antv-ava
description: Convert quantitative facts in text into dsh-antv-ava DSL for inline AVA chart recommendation and automatic data insights in DSH. Use when the user asks to visualize, chart, analyze, interpret, compare, rank, or find trends, proportions, distributions, outliers, change points, or correlations in text that contains supported numeric data.
---

# AntV AVA for DSH

Interpret the source text, extract only supported quantitative facts, and emit one `ava` fenced block. Do not invent missing values to make qualitative text chartable.

## Output contract

```ava
ava
title <title>
description <optional description>
purpose <optional purpose>
language <zh-CN or en-US>
fields
  - id <ascii_id>
    label <display label with optional unit>
    type <categorical|quantitative|temporal>
    role <dimension|measure>
data
  - <field_id> <value>
    <field_id> <value>
```

Use exactly two spaces per nesting level. Start each field and data row with `  -`; indent its remaining properties with four spaces.

## Select the analysis purpose

- `Comparison`: compare values across categories.
- `Trend`: show change across ordered time.
- `Distribution`: show spread or frequency.
- `Rank`: order categories by value.
- `Proportion`: show shares of a whole.
- `Composition`: compare components across groups or time.

Omit `purpose` when the data supports several reasonable views and AVA should decide.

## Extract fields

- Use ASCII field ids such as `quarter`, `revenue`, or `conversion_rate`.
- Put human-readable names and units in `label`, not in numeric values.
- Mark dates, quarters, ordered stages, and categories as `dimension`.
- Mark values that should be aggregated or compared as `measure` with type `quantitative`.
- Preserve temporal values as written when they sort naturally; prefer ISO dates for exact dates.
- Include 2–12 fields and normally 3–50 rows.

## Evidence rules

- Encode only facts directly stated by the user or available source.
- Preserve uncertainty in prose outside the fence; do not convert vague words such as “many” or “rapidly” into numbers.
- Do not infer missing periods as zero unless the source explicitly says zero.
- Keep percentages as numeric percentage points: write `42`, not `42%` or `0.42`, and include `%` in the field label.
- Do not mix incompatible units in one measure field.
- If the text has no meaningful numeric comparison, answer in prose or use an infographic instead of AVA.

## Example

For “Q1 revenue was 128, Q2 was 164, Q3 was 191, and Q4 was 226”:

```ava
ava
title 季度收入趋势
purpose Trend
language zh-CN
fields
  - id quarter
    label 季度
    type temporal
    role dimension
  - id revenue
    label 收入
    type quantitative
    role measure
data
  - quarter Q1
    revenue 128
  - quarter Q2
    revenue 164
  - quarter Q3
    revenue 191
  - quarter Q4
    revenue 226
```

Before emitting the fence, verify that every row contains every declared field, all measure values are numeric, the purpose matches the question, and no value was invented.
