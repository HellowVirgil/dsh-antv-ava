<p align="center">
  🌐 <a href="./README.zh-CN.md">简体中文</a> | English
</p>

<h1 align="center">dsh-antv-ava</h1>

<p align="center">
  Let DeepSeek Harness automatically present data-heavy answers as streaming narrative text, AntV charts, or a natural combination of both.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-antv-ava?logo=npm&color=cb3837"></a>
  <a href="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HellowVirgil/dsh-antv-ava/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/dsh-antv-ava"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-antv-ava?logo=npm"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/npm/l/dsh-antv-ava"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AntV_AVA-3.4.1-1677ff" alt="AntV AVA 3.4.1">
  <img src="https://img.shields.io/badge/streaming-supported-16a34a" alt="Streaming supported">
  <img src="https://img.shields.io/badge/theme-light%20%7C%20dark-8b5cf6" alt="Light and dark themes">
</p>

## Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/HellowVirgil/dsh-antv-ava/main/docs/images/ava-preview.jpg" alt="dsh-antv-ava rendering data interpretation and an AntV chart inside a DSH conversation" width="100%">
</p>

Narrative text and charts flow directly with the model reply instead of appearing in separate cards. Text can render progressively while the model is generating, and charts join the same conversation once their data is complete.

## Core features

- Automatic presentation selection: the model chooses NTV, a chart, or both based on the question and data.
- Streaming data interpretation: metrics, changes, shares, category details, and conclusions render phrase by phrase.
- AntV charts: AVA Advisor / Insight recommends a visualization and AntV G2 renders it.
- Conversation-native design: inherits DSH typography, font size, line height, color, width, and Markdown spacing.
- Live theme adaptation: chart axes, labels, and grid lines update when switching between light and dark themes without a page refresh.
- Semantic data expression: highlighted metrics, direction arrows, absolute changes, rates, contributions, and proportion micro charts.
- Lazy loading: the AVA/G2 chart engine loads only when an answer contains a chart.
- Safe parsing: source-size limits and blocking for executable markup, dangerous URLs, and private-network resources.

## Installation

```bash
dsh plugin --profile web add dsh-antv-ava
```

Restart `dsh web` and reload the page after installation. The plugin injects the required output contract automatically, so regular users do not need to install a separate Skill or write DSL by hand.

## Usage

Ask naturally after installation.

### Interpret data

```text
Interpret the following business data and provide concise, easy-to-scan conclusions:
Total orders reached 198M this month, up 7.05% year over year…
```

The model will usually return streaming NTV with emphasized metrics, changes, shares, and category conclusions.

### Interpret and visualize

```text
Analyze the revenue change from Q1 to Q4 and choose an appropriate visualization:
Q1 1.28M, Q2 1.64M, Q3 1.91M, Q4 2.26M.
```

When visual shape makes a trend or comparison easier to understand, the model combines narrative text with a chart.

### Generate only a chart

```text
Plot the following data as a trend chart. Return only the chart: …
```

When explicitly requested, the model can return a chart without repeating the same information as narrative text.

## Automatic output selection

| Content | Typical result |
| --- | --- |
| KPIs, period-over-period changes, shares, category breakdowns, and conclusions | NTV |
| Trends, comparisons, distributions, rankings, or compositions benefit from shape | NTV + Chart |
| The user explicitly requests only a chart, or narrative adds no value | Chart |

This selection is automatic; users do not need to understand the internal format.

## Supported data expression

NTV supports:

- Primary and secondary metrics and dimension values
- Time descriptions and trend conclusions
- Absolute changes and change rates
- Shares, contributions, and inline proportion micro charts
- Headlines, heading levels 1–6, paragraphs, bullets, sections, and dividers

Charts support common AVA analysis purposes:

- Comparison
- Trend
- Distribution
- Rank
- Proportion
- Composition

## Optional Skill installation

The plugin works on its own. Install the bundled Skill only when the agent environment discovers `~/.agents/skills` and complex data tasks need stricter guidance for fact preservation and presentation selection.

```bash
mkdir -p ~/.agents/skills/antv-ava
cp SKILL.md ~/.agents/skills/antv-ava/SKILL.md
```

## Advanced: unified AVA format

The model can emit `narrative`, `chart`, or both inside one `ava` fence:

````markdown
```ava
ava
language en-US
narrative
  headline Quarterly revenue continued to grow
  paragraph
    text Q4 revenue reached
    metric-value 2.26M
    text , up from Q1 by
    ratio positive 76.6%
chart
  title Quarterly revenue trend
  purpose Trend
  fields
    - id quarter
      label Quarter
      type categorical
      role dimension
    - id revenue
      label Revenue (M)
      type quantitative
      role measure
  data
    - quarter Q1
      revenue 1.28
    - quarter Q4
      revenue 2.26
```
````

Legacy `ava ntv`, `ava chart`, and bare chart-style `ava` content remains renderable.

## Scope

Use the plugin for evidence-backed KPIs, business analysis, trends, shares, rankings, and category breakdowns. It does not invent values for visualization and never executes arbitrary HTML, SVG, or scripts emitted by the model.

Processes, hierarchies, and roadmaps without meaningful numeric structure are better suited to an infographic plugin.

## Install from source

```bash
git clone https://github.com/HellowVirgil/dsh-antv-ava.git
cd dsh-antv-ava
pnpm install
pnpm run check
dsh plugin --profile web add "link:$PWD"
```

## Development

```bash
pnpm test
pnpm build
pnpm run verify:pack
```

## License

MIT. AntV AVA and AntV G2 are also licensed under MIT.
